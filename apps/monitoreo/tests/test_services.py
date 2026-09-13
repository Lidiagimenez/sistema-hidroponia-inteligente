from django.test import TestCase
from datetime import date

from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class ValidacionMedicionTest(TestCase):

    def setUp(self):
        usuario = Usuario.objects.create_user(username="op_val", password="test12345")
        cultivo = Cultivo.objects.create(nombre="Lechuga", fecha_creacion=date.today(), usuario=usuario)
        dispositivo = Dispositivo.objects.create(
            nombre="ESP32", tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="HW-VAL", cultivo=cultivo,
        )
        self.tipo_sensor = TipoSensor.objects.create(
            nombre="TDS", unidad_medida="ppm", valor_min_fisico=0, valor_max_fisico=1000,
        )
        self.sensor = Sensor.objects.create(dispositivo=dispositivo, tipo_sensor=self.tipo_sensor)
        RangoOperacion.objects.create(sensor=self.sensor, valor_min=400, valor_max=800)

    def test_medicion_normal(self):
        medicion = Medicion.objects.create(sensor=self.sensor, valor=600)
        medicion.refresh_from_db()
        self.assertEqual(medicion.estado_lectura, Medicion.EstadoLectura.NORMAL)

    def test_medicion_fuera_de_rango_operativo(self):
        medicion = Medicion.objects.create(sensor=self.sensor, valor=900)
        medicion.refresh_from_db()
        self.assertEqual(medicion.estado_lectura, Medicion.EstadoLectura.FUERA_RANGO)

    def test_medicion_fuera_de_rango_fisico(self):
        # RF-37: 4000 ppm en un sensor de 0-1000 ppm — imposible físicamente
        medicion = Medicion.objects.create(sensor=self.sensor, valor=4000)
        medicion.refresh_from_db()
        self.assertEqual(medicion.estado_lectura, Medicion.EstadoLectura.FUERA_RANGO)