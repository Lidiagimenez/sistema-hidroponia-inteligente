from datetime import date, timedelta
from django.test import TestCase

from apps.usuarios.models import Usuario
from apps.cultivos.models import Cultivo
from apps.dispositivos.models import Dispositivo
from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion
from apps.alertas.models import ParametroAlerta, Alerta
from apps.intervenciones.models import Intervencion


class FlujoCompletoTest(TestCase):
    """Test de integración: medición fuera de rango -> alerta -> intervención -> resuelta."""

    def setUp(self):
        # Usuario operador (el que registra la intervención)
        self.operador = Usuario.objects.create_user(
            username="op_integracion", password="test12345", rol=Usuario.Rol.OPERADOR,
        )
        # Cultivo
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga", fecha_creacion=date.today(), usuario=self.operador,
        )
        # Dispositivo sensor
        self.dispositivo = Dispositivo.objects.create(
            nombre="ESP32-Integracion",
            tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="HW-INTEG",
            cultivo=self.cultivo,
        )
        # Tipo de sensor y sensor
        self.tipo_sensor = TipoSensor.objects.create(
            nombre="Temperatura", unidad_medida="°C",
            valor_min_fisico=-10, valor_max_fisico=60,
        )
        self.sensor = Sensor.objects.create(
            dispositivo=self.dispositivo, tipo_sensor=self.tipo_sensor,
        )
        # Rango operativo: 18-26 °C
        RangoOperacion.objects.create(sensor=self.sensor, valor_min=18, valor_max=26)
        # Parámetros de alerta: N=3 para abrir, N=3 para cerrar
        ParametroAlerta.objects.create(
            tipo_sensor=self.tipo_sensor,
            tiempo_maximo_sin_lectura=timedelta(minutes=10),
            lecturas_consecutivas_apertura=3,
            lecturas_consecutivas_cierre=3,
            umbral_desviacion_alta=30,
        )

    def test_flujo_completo(self):
        # ─── PASO 1: 3 mediciones fuera de rango (35°C) → debe abrir alerta ───
        for _ in range(3):
            Medicion.objects.create(sensor=self.sensor, valor=35)

        alerta = Alerta.objects.filter(estado=Alerta.Estado.ACTIVA).first()
        self.assertIsNotNone(alerta, "Debería haberse creado una alerta ACTIVA")
        self.assertEqual(alerta.medicion.sensor, self.sensor)

        # ─── PASO 2: el operador crea una intervención sobre esa alerta ───
        intervencion = Intervencion.objects.create(
            alerta=alerta,
            operador=self.operador,
            observaciones="Se ajustó el sensor de temperatura.",
        )
        self.assertEqual(intervencion.operador, self.operador)
        self.assertEqual(intervencion.alerta, alerta)
        self.assertFalse(intervencion.resuelta)

        # ─── PASO 3: 3 mediciones normales (22°C) → debe cerrar la alerta ───
        for _ in range(3):
            Medicion.objects.create(sensor=self.sensor, valor=22)

        alerta.refresh_from_db()
        self.assertEqual(
            alerta.estado, Alerta.Estado.RESUELTA,
            "La alerta debería haberse resuelto automáticamente tras 3 lecturas normales",
        )

        # ─── PASO 4: el operador marca la intervención como resuelta ───
        intervencion.resuelta = True
        intervencion.save(update_fields=["resuelta"])
        intervencion.refresh_from_db()
        self.assertTrue(intervencion.resuelta)