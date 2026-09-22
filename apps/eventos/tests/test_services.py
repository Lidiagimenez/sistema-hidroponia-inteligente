from django.test import TestCase
from django.utils import timezone
from datetime import date, timedelta

from apps.eventos.services import detectar_sensores_sin_comunicacion
from apps.monitoreo.models import TipoSensor, Sensor, Medicion
from apps.alertas.models import ParametroAlerta
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario
from apps.eventos.models import Evento


class DeteccionEventosTest(TestCase):

    def setUp(self):
        usuario = Usuario.objects.create_user(username="op_evt2", password="test12345")
        self.cultivo = Cultivo.objects.create(nombre="Lechuga", fecha_creacion=date.today(), usuario=usuario)
        self.dispositivo = Dispositivo.objects.create(
            nombre="ESP32", tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="HW-DET", cultivo=self.cultivo,
        )
        tipo_sensor = TipoSensor.objects.create(
            nombre="Temperatura", unidad_medida="°C", valor_min_fisico=-10, valor_max_fisico=60,
        )
        self.sensor = Sensor.objects.create(dispositivo=self.dispositivo, tipo_sensor=tipo_sensor)
        ParametroAlerta.objects.create(
            tipo_sensor=tipo_sensor, tiempo_maximo_sin_lectura=timedelta(minutes=10), umbral_desviacion_alta=30,
        )

    def test_detecta_sensor_sin_comunicacion(self):
        medicion = Medicion.objects.create(sensor=self.sensor, valor=20)
        Medicion.objects.filter(pk=medicion.pk).update(fecha_hora=timezone.now() - timedelta(minutes=30))

        eventos = detectar_sensores_sin_comunicacion()
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0].tipo_evento, Evento.TipoEvento.SENSOR_SIN_COMUNICACION)

    def test_no_duplica_evento_ya_existente(self):
        medicion = Medicion.objects.create(sensor=self.sensor, valor=20)
        Medicion.objects.filter(pk=medicion.pk).update(fecha_hora=timezone.now() - timedelta(minutes=30))

        detectar_sensores_sin_comunicacion()
        eventos_segunda_vez = detectar_sensores_sin_comunicacion()
        self.assertEqual(len(eventos_segunda_vez), 0)