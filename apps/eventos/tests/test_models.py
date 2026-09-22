from django.test import TestCase
from datetime import date

from apps.eventos.models import Evento
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class EventoModelTest(TestCase):

    def setUp(self):
        usuario = Usuario.objects.create_user(username="op_evt", password="test12345")
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            fecha_creacion=date.today(),
            usuario=usuario,
        )
        self.dispositivo = Dispositivo.objects.create(
            nombre="ESP32",
            tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="ESP32-EVT",
            cultivo=self.cultivo,
        )

    def test_evento_sensor_sin_comunicacion(self):
        evento = Evento.objects.create(
            tipo_evento=Evento.TipoEvento.SENSOR_SIN_COMUNICACION,
            dispositivo=self.dispositivo, cultivo=self.cultivo,
        )
        self.assertIsNotNone(evento.dispositivo)

    def test_evento_corte_electrico_sin_dispositivo(self):
        evento = Evento.objects.create(
            tipo_evento=Evento.TipoEvento.CORTE_ELECTRICO,
            dispositivo=None, cultivo=self.cultivo,
        )
        self.assertIsNone(evento.dispositivo)