from datetime import date

from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario
from apps.cultivos.models import Cultivo
from apps.eventos.models import Evento


class EventosPermisosTest(APITestCase):

    def setUp(self):
        self.operador = Usuario.objects.create_user(
            username="op_test", password="test1234", rol="operador"
        )
        self.admin = Usuario.objects.create_user(
            username="adm_test", password="test1234", rol="administrador"
        )
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga test",
            fecha_creacion=date.today(),
            usuario=self.admin,
        )
        self.evento = Evento.objects.create(
            tipo_evento="sensor_sin_comunicacion",
            cultivo=self.cultivo,
            descripcion="Test",
        )

    def test_operador_puede_ver_eventos(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/eventos/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_ver_eventos(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/eventos/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_operador_no_puede_crear_evento(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/eventos/", {
            "tipo_evento": "corte_electrico",
            "cultivo": self.cultivo.pk,
        })
        # ReadOnlyModelViewSet → 405 Method Not Allowed
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_admin_tampoco_puede_crear_evento(self):
        """Los eventos son automáticos. Nadie los crea por API."""
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/eventos/", {
            "tipo_evento": "corte_electrico",
            "cultivo": self.cultivo.pk,
        })
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_usuario_anonimo_no_puede_ver_eventos(self):
        r = self.client.get("/api/eventos/")
        # Sin autenticación → 401 Unauthorized
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)