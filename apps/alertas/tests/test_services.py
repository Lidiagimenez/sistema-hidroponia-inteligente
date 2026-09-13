from django.test import TestCase
from datetime import date

from apps.dispositivos.services import crear_dispositivo, cambiar_estado_dispositivo
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class DispositivoServiceTest(TestCase):

    def setUp(self):
        usuario = Usuario.objects.create_user(username="op_svc", password="test12345")
        self.cultivo = Cultivo.objects.create(nombre="Lechuga", fecha_creacion=date.today(), usuario=usuario)

    def test_crear_dispositivo_service(self):
        dispositivo = crear_dispositivo("ESP32", Dispositivo.TipoDispositivo.SENSOR, "HW-001", self.cultivo)
        self.assertEqual(dispositivo.estado, Dispositivo.Estado.ACTIVO)

    def test_cambiar_estado(self):
        dispositivo = crear_dispositivo("ESP32", Dispositivo.TipoDispositivo.SENSOR, "HW-002", self.cultivo)
        cambiar_estado_dispositivo(dispositivo, Dispositivo.Estado.INACTIVO)
        dispositivo.refresh_from_db()
        self.assertEqual(dispositivo.estado, Dispositivo.Estado.INACTIVO)