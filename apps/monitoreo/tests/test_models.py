from django.test import TestCase
from datetime import date

from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class MonitoreoModelTest(TestCase):

    def setUp(self):
        usuario = Usuario.objects.create_user(username="op_mon", password="test12345")
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            fecha_creacion=date.today(),
            usuario=usuario,
        )
        self.dispositivo = Dispositivo.objects.create(
            nombre="ESP32",
            tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="ESP32-MON",
            cultivo=self.cultivo,
        )
        self.tipo_sensor = TipoSensor.objects.create(
            nombre="Temperatura", unidad_medida="°C",
            valor_min_fisico=-10, valor_max_fisico=60,
        )

    def test_crear_sensor(self):
        sensor = Sensor.objects.create(dispositivo=self.dispositivo, tipo_sensor=self.tipo_sensor)
        self.assertEqual(sensor.tipo_sensor, self.tipo_sensor)

    def test_crear_rango_operacion(self):
        sensor = Sensor.objects.create(dispositivo=self.dispositivo, tipo_sensor=self.tipo_sensor)
        rango = RangoOperacion.objects.create(sensor=sensor, valor_min=18, valor_max=26)
        self.assertEqual(rango.sensor, sensor)

    def test_crear_medicion_default_normal(self):
        sensor = Sensor.objects.create(dispositivo=self.dispositivo, tipo_sensor=self.tipo_sensor)
        medicion = Medicion.objects.create(sensor=sensor, valor=22.5)
        self.assertEqual(medicion.estado_lectura, Medicion.EstadoLectura.NORMAL)

    def test_tipo_sensor_protegido_si_tiene_sensores(self):
        Sensor.objects.create(dispositivo=self.dispositivo, tipo_sensor=self.tipo_sensor)
        with self.assertRaises(Exception):
            self.tipo_sensor.delete()