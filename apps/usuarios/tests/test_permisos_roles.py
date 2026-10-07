from rest_framework.test import APITestCase
from rest_framework import status
from apps.usuarios.models import Usuario


class PermisosOperadorTest(APITestCase):

    def setUp(self):
        """Esto se ejecuta ANTES de cada test. Prepara el escenario."""
        # Creo un operador
        self.operador = Usuario.objects.create_user(
            username="operador_test",
            password="test1234",
            rol="operador",
        )
        # Creo un administrador
        self.admin = Usuario.objects.create_user(
            username="admin_test",
            password="test1234",
            rol="administrador",
        )

    def test_operador_no_puede_crear_cultivo(self):
        """El operador intenta POST y debe recibir 403."""
        # 1. Me "logueo" como operador (sin pasar por el login real)
        self.client.force_authenticate(self.operador)

        # 2. Hago la petición como si fuera el frontend
        respuesta = self.client.post("/api/cultivos/", {
            "nombre": "Lechuga test",
        })

        # 3. Verifico que la respuesta sea 403 Forbidden
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_si_puede_crear_cultivo(self):
        """El admin intenta POST y NO debe recibir 403."""
        self.client.force_authenticate(self.admin)

        respuesta = self.client.post("/api/cultivos/", {
            "nombre": "Lechuga test",
        })

        # No me importa si da 201 o 400 (por datos faltantes),
        # lo importante es que NO sea 403
        self.assertNotEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)