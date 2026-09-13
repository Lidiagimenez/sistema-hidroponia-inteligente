from datetime import date

from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario
from apps.cultivos.models import Cultivo
from apps.dispositivos.models import Dispositivo


class DispositivoAPITest(APITestCase):

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_disp", password="test12345", rol=Usuario.Rol.ADMINISTRADOR
        )
        self.operador = Usuario.objects.create_user(
            username="op_disp", password="test12345", rol=Usuario.Rol.OPERADOR
        )
        self.cultivo = Cultivo.objects.create(nombre="Lechuga", fecha_creacion=date.today(), usuario=self.admin)

    def test_admin_puede_crear_dispositivo(self):
        self.client.force_authenticate(user=self.admin)
        data = {
            "nombre": "ESP32",
            "tipo_dispositivo": Dispositivo.TipoDispositivo.SENSOR,
            "identificador_hardware": "HW-100",
            "cultivo": self.cultivo.id,
        }
        response = self.client.post("/api/dispositivos/", data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_operador_no_puede_crear_dispositivo(sel