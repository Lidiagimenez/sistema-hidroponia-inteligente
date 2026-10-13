from django.test import TestCase
from datetime import date
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.intervenciones.models import Intervencion
from apps.alertas.models import Alerta
from apps.monitoreo.models import TipoSensor, Sensor, Medicion
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import CicloProduccion, Cultivo
from apps.usuarios.models import Usuario


class IntervencionModelTest(TestCase):

    def setUp(self):
        self.usuario = Usuario.objects.create_user(username="operador1", password="test12345")
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            fecha_creacion=date.today(),
            usuario=self.usuario,
        )
        self.ciclo = CicloProduccion.objects.create(cultivo=self.cultivo, fecha_inicio=date.today())
        dispositivo = Dispositivo.objects.create(
            nombre="ESP32",
            tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="ESP32-INT",
            cultivo=self.cultivo,
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

    def test_crear_intervencion_con_cultivo(self):
        intervencion = Intervencion.objects.create(
            cultivo=self.cultivo,
            operador=self.usuario,
            tipo=Intervencion.Tipo.TRATAMIENTO,
            observaciones="Se aplicó tratamiento preventivo.",
            descripcion_accion="Revisión visual y aplicación foliar.",
        )

        self.assertEqual(intervencion.cultivo, self.cultivo)
        self.assertEqual(intervencion.tipo, Intervencion.Tipo.TRATAMIENTO)

    def test_crear_intervencion_cosecha(self):
        intervencion = Intervencion.objects.create(
            ciclo=self.ciclo,
            operador=self.usuario,
            tipo=Intervencion.Tipo.COSECHA,
            observaciones="Cosecha completa.",
            descripcion_accion="Se cosechó el ciclo principal.",
            fecha_cosecha_real=timezone.now(),
            resultado_cosecha=Intervencion.ResultadoCosecha.EXITOSA,
            cantidad_cosechada_kg=1.25,
        )

        self.assertEqual(intervencion.ciclo, self.ciclo)
        self.assertEqual(intervencion.resultado_cosecha, Intervencion.ResultadoCosecha.EXITOSA)

    def test_intervencion_sin_origen_no_es_valida(self):
        intervencion = Intervencion(
            operador=self.usuario,
            observaciones="Sin origen.",
        )

        with self.assertRaises(ValidationError):
            intervencion.clean()
