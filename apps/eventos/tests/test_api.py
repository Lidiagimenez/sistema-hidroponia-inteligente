from rest_framework import status
from rest_framework.test import APITestCase

from apps.usuarios.models import Usuario


class EventosApiTest(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_ev", password="test12345", rol=Usuario.Rol.ADMINISTRADOR
        )
        self.operador = Usuario.objects.create_user(
            username="op_ev", password="test12345", rol=Usuario.Rol.OPERADOR
        )

    def test_sin_login_es_401(self):
        self.assertEqual(self.client.get("/api/eventos/").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ambos_roles_pueden_listar(self):
        for usuario in (self.admin, self.operador):
            with self.subTest(usuario=usuario.username):
                self.client.force_authenticate(user=usuario)
                self.assertEqual(self.client.get("/api/eventos/").status_code, status.HTTP_200_OK)

    def test_eventos_es_solo_lectura(self):
        # Los eventos los genera el sistema; nadie los crea ni edita por la API.
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.post("/api/eventos/", {}, format="json").status_code,
                         status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_filtro_por_tipo_evento_responde_ok(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get("/api/eventos/?tipo_evento=corte_electrico")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
