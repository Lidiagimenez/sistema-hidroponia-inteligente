from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario


class UsuariosPermisosTest(APITestCase):

    def setUp(self):
        self.operador = Usuario.objects.create_user(
            username="op_test", password="test1234", rol="operador"
        )
        self.admin = Usuario.objects.create_user(
            username="adm_test", password="test1234", rol="administrador"
        )

    def test_operador_no_puede_listar_usuarios(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/usuarios/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_operador_no_puede_crear_usuario(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/usuarios/", {
            "username": "nuevo", "password": "test1234", "rol": "operador"
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_si_puede_listar_usuarios(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/usuarios/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_si_puede_crear_usuario(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/usuarios/", {
            "username": "nuevo", "password": "test1234", "rol": "operador"
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_me_devuelve_rol(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/me/")   # ← cambiado
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["rol"], "operador")