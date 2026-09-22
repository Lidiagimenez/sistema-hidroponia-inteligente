from django.test import TestCase
from datetime import date

from apps.intervenciones.models import Intervencion
from apps.alertas.models import Alerta
from apps.monitoreo.models import TipoSensor, Sensor, Medicion
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class IntervencionModelTest(TestCase):

    def setUp(self):
        self.usuario = Usuario.objects.create_user(username="operador1", password="test12345")
        cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            fecha_creacion=date.today(),
            usuario=self.usuario,
        )
        dispositivo = Dispositivo.objects.create(
            nombre="ESP32",
            tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="ESP32-INT",
            cultivo=cultivo,
        )
        tipo_sensor = TipoSensor.objects.create(
            nombre="Temperatura", unidad_medida="°C",
            valor_min_fisico=-10, valor_max_fisico=60,
        )
        sensor = Sensor.objects.create(dispositivo=dispositivo, tipo_sensor=tipo_sensor)
        medicion = Medicion.objects.create(sensor=sensor, valor=99)
        self.alerta = Alerta.objects.create(medicion=medicion, severidad=Alerta.Severidad.ALTA)

    def test_crear_intervencion(self):
        intervencion = Intervencion.objects.create(
            alerta=self.alerta,
            operador=self.usuario,
            observaciones="Se revisó el sensor.",
        )
        self.assertFalse(intervencion.resuelta)