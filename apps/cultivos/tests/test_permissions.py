from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase

from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class CultivoPermissionsTest(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_cp", password="test12345", rol=Usuario.Rol.ADMINISTRADOR
        )
        self.operador = Usuario.objects.create_user(
            username="op_cp", password="test12345", rol=Usuario.Rol.OPERADOR
        )
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga", fecha_creacion=date.today(), usuario=self.admin
        )

    def test_sin_login_es_401(self):
        self.assertEqual(self.client.get("/api/cultivos/").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_operador_puede_ver(self):
        self.client.force_authenticate(user=self.operador)
        self.assertEqual(self.client.get("/api/cultivos/").status_code, status.HTTP_200_OK)

    def test_operador_no_puede_crear(self):
        self.client.force_authenticate(user=self.operador)
        r = self.client.post("/api/cultivos/", {"nombre": "X", "fecha_creacion": str(date.today())},
                             format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_operador_no_puede_borrar(self):
        self.client.force_authenticate(user=self.operador)
        r = self.client.delete(f"/api/cultivos/{self.cultivo.pk}/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_borrar(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.delete(f"/api/cultivos/{self.cultivo.pk}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
