from django.test import TestCase
from datetime import date, timedelta

from apps.alertas.models import ParametroAlerta, Alerta
from apps.monitoreo.models import TipoSensor, Sensor, Medicion
from apps.eventos.models import Evento
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class AlertasModelTest(TestCase):

    def setUp(self):
        usuario = Usuario.objects.create_user(username="op_alert", password="test12345")
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            fecha_creacion=date.today(),
            usuario=usuario,
        )
        self.dispositivo = Dispositivo.objects.create(
            nombre="ESP32",
            tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="ESP32-ALT",
            cultivo=self.cultivo,
        )
        self.tipo_sensor = TipoSensor.objects.create(
            nombre="Temperatura", unidad_medida="°C",
            valor_min_fisico=-10, valor_max_fisico=60,
        )
        self.sensor = Sensor.objects.create(dispositivo=self.dispositivo, tipo_sensor=self.tipo_sensor)

    def test_crear_parametro_alerta(self):
        parametro = ParametroAlerta.objects.create(
            tipo_sensor=self.tipo_sensor,
            tiempo_maximo_sin_lectura=timedelta(minutes=10),
            umbral_desviacion_alta=30,
        )
        self.assertEqual(parametro.lecturas_consecutivas_apertura, 3)

    def test_alerta_por_medicion(self):
        medicion = Medicion.objects.create(sensor=self.sensor, valor=99)
        alerta = Alerta.objects.create(medicion=medicion, severidad=Alerta.Severidad.ALTA)
        self.assertIsNone(alerta.evento)

    def test_alerta_por_evento(self):
        evento = Evento.objects.create(
            tipo_evento=Evento.TipoEvento.CORTE_ELECTRICO, cultivo=self.cultivo,
        )
        alerta = Alerta.objects.create(evento=evento, severidad=Alerta.Severidad.ALTA)
        self.assertIsNone(alerta.medicion)

    def test_alerta_no_puede_tener_ambos_origenes(self):
        medicion = Medicion.objects.create(sensor=self.sensor, valor=50)
        evento = Evento.objects.create(
            tipo_evento=Evento.TipoEvento.BOMBA_SIN_CAUDAL, cultivo=self.cultivo,
        )
        alerta = Alerta(medicion=medicion, evento=evento, severidad=Alerta.Severidad.ALTA)
        with self.assertRaises(Exception):
            alerta.full_clean()