from django.test import TestCase
from datetime import date

from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class DispositivoModelTest(TestCase):

    def setUp(self):
        self.usuario = Usuario.objects.create_user(username="op_disp", password="test12345")
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            fecha_creacion=date.today(),   # 👈 CORREGIDO (antes decía fecha_inicio)
            usuario=self.usuario,
        )

    def test_crear_dispositivo(self):
        dispositivo = Dispositivo.objects.create(
            nombre="ESP32 Cultivo 1",
            tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="ESP32-001",
            cultivo=self.cultivo,
        )
        self.assertEqual(dispositivo.estado, Dispositivo.Estado.ACTIVO)
        self.assertEqual(dispositivo.cultivo, self.cultivo)

    def test_identificador_hardware_unico(self):
        Dispositivo.objects.create(
            nombre="ESP32 A", tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="ESP32-DUP", cultivo=self.cultivo,
        )
        with self.assertRaises(Exception):
            Dispositivo.objects.create(
                nombre="ESP32 B", tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
                identificador_hardware="ESP32-DUP", cultivo=self.cultivo,
            )