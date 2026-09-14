from datetime import date

from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario
from apps.cultivos.models import Cultivo
from apps.dispositivos.models import Dispositivo


class DispositivoPermissionsTest(APITestCase):

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_perm", password="test12345", rol=Usuario.Rol.ADMINISTRADOR
        )
        self.operador = Usuario.objects.create_user(
            username="op_perm", password="test12345", rol=Usuario.Rol.OPERADOR
        )
        self.cultivo = Cultivo.objects.create(nombre="Lechuga", fecha_creacion=date.today(), usuario=self.admin)
        self.dispositivo = Dispositivo.objects.create(
            nombre="ESP32", tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="HW-200", cultivo=self.cultivo,
        )

    def test_operador_no_puede_borrar(self):
        self.client.force_authenticate(user=self.operador)
        response = self.client.delete(f"/api/dispositivos/{self.dispositivo.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_borrar(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f"/api/dispositivos/{self.dispositivo.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_usuario_no_autenticado_no_accede(self):
        response = self.client.get("/api/dispositivos/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)