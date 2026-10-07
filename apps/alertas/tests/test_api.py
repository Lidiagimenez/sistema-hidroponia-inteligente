from rest_framework import status
from rest_framework.test import APITestCase

from apps.usuarios.models import Usuario


class AlertasApiTest(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_al", password="test12345", rol=Usuario.Rol.ADMINISTRADOR
        )
        self.operador = Usuario.objects.create_user(
            username="op_al", password="test12345", rol=Usuario.Rol.OPERADOR
        )

    def test_sin_login_es_401(self):
        self.assertEqual(self.client.get("/api/alertas/").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ambos_roles_ven_alertas(self):
        for usuario in (self.admin, self.operador):
            with self.subTest(usuario=usuario.username):
                self.client.force_authenticate(user=usuario)
                self.assertEqual(self.client.get("/api/alertas/").status_code, status.HTTP_200_OK)

    def test_alertas_es_solo_lectura(self):
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.post("/api/alertas/", {}, format="json").status_code,
                         status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_filtros_por_estado_y_severidad(self):
        self.client.force_authenticate(user=self.operador)
        r = self.client.get("/api/alertas/?estado=activa&severidad=alta")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_parametros_de_alerta_solo_admin(self):
        self.client.force_authenticate(user=self.operador)
        self.assertEqual(self.client.get("/api/parametros-alerta/").status_code,
                         status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get("/api/parametros-alerta/").status_code,
                         status.HTTP_200_OK)
