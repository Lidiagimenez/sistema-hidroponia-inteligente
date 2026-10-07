"""
Tests del módulo de IA — Detección de anomalías con Isolation Forest.

Cubre:
  - Entrenamiento con pocos / suficientes datos.
  - Evaluación de mediciones contra el modelo entrenado.
  - Detección end-to-end que crea Anomalia.
  - Management command `entrenar_modelos`.
  - Señal `post_save` sin romper.

Los tests redirigen `ia.MODELO_DIR` a un directorio temporal para
no ensuciar el proyecto con modelos entrenados durante los tests.
"""

import random
import shutil
import tempfile
from datetime import date
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from apps.cultivos.models import Cultivo
from apps.dispositivos.models import Dispositivo
from apps.inteligencia import ia
from apps.inteligencia.models import Anomalia
from apps.monitoreo.models import (
    Medicion,
    RangoOperacion,
    Sensor,
    TipoSensor,
)
from apps.usuarios.models import Usuario


class IABaseTestCase(TestCase):
    """Setup común: objetos mínimos + MODELO_DIR temporal."""

    def setUp(self):
        # Redirigir el directorio de modelos a uno temporal
        self.tmp_dir = Path(tempfile.mkdtemp(prefix="test_ia_models_"))
        self.original_dir = ia.MODELO_DIR
        ia.MODELO_DIR = self.tmp_dir

        # Objetos mínimos
        self.op = Usuario.objects.create_user(
            username="ia_op", password="x", rol=Usuario.Rol.OPERADOR,
        )
        self.cultivo = Cultivo.objects.create(
            nombre="IA-Test", fecha_creacion=date.today(), usuario=self.op,
        )
        self.disp = Dispositivo.objects.create(
            nombre="ESP32-IA-Test",
            tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="HW-IA-TEST-01",
            cultivo=self.cultivo,
        )
        self.tipo = TipoSensor.objects.create(
            nombre="pH-IA-Test",
            unidad_medida="pH",
            valor_min_fisico=0,
            valor_max_fisico=14,
        )
        self.sensor = Sensor.objects.create(
            dispositivo=self.disp,
            tipo_sensor=self.tipo,
        )
        RangoOperacion.objects.create(
            sensor=self.sensor, valor_min=5.5, valor_max=6.5,
        )

    def tearDown(self):
        ia.MODELO_DIR = self.original_dir
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _crear_mediciones_bulk(self, valores):
        """Crea mediciones con bulk_create (no dispara señales)."""
        mediciones = [
            Medicion(sensor=self.sensor, valor=v, estado_lectura="normal")
            for v in valores
        ]
        Medicion.objects.bulk_create(mediciones)

    def _generar_datos_normales(self, n=150, media=6.0, sigma=0.15):
        """
        Genera una distribución gaussiana para entrenar el modelo.

        Isolation Forest funciona mejor con distribuciones continuas:
        con 150 muestras gaussianas, el valor 'media' queda bien
        centrado y no se marca como anómalo.
        """
        random.seed(42)  # reproducible
        return [media + random.gauss(0, sigma) for _ in range(n)]


class EntrenamientoTest(IABaseTestCase):

    def test_no_entrena_sin_datos(self):
        """Sin mediciones, no hay nada con qué entrenar."""
        modelo = ia.entrenar_modelo(self.tipo.id)
        self.assertIsNone(modelo)

    def test_no_entrena_con_pocos_datos(self):
        """Con 10 muestras (<50), no entrena."""
        self._crear_mediciones_bulk([6.0] * 10)
        modelo = ia.entrenar_modelo(self.tipo.id)
        self.assertIsNone(modelo)

    def test_entrena_con_suficientes_datos(self):
        """Con suficientes muestras, entrena y guarda el archivo .joblib."""
        self._crear_mediciones_bulk(self._generar_datos_normales())

        modelo = ia.entrenar_modelo(self.tipo.id)
        self.assertIsNotNone(modelo)

        ruta = ia._ruta_modelo(self.tipo.id)
        self.assertTrue(ruta.exists())
        self.assertIn("iforest_tipo_sensor", ruta.name)


class EvaluacionTest(IABaseTestCase):

    def test_evaluar_sin_modelo_devuelve_none(self):
        """Sin modelo entrenado, evaluar devuelve (None, False)."""
        m = Medicion.objects.create(sensor=self.sensor, valor=6.0)
        score, es_anomalia = ia.evaluar_medicion(m)
        self.assertIsNone(score)
        self.assertFalse(es_anomalia)

    def test_evaluar_valor_normal_no_es_anomalia(self):
        """Un valor típico no debe ser marcado como anomalía."""
        self._crear_mediciones_bulk(self._generar_datos_normales())
        ia.entrenar_modelo(self.tipo.id)

        m = Medicion.objects.create(sensor=self.sensor, valor=6.05)
        score, es_anomalia = ia.evaluar_medicion(m)
        self.assertIsNotNone(score)
        self.assertFalse(
            es_anomalia,
            f"Valor 6.05 no debería ser anomalía (score={score})",
        )

    def test_evaluar_valor_extremo_es_anomalia(self):
        """Un valor extremo debe marcarse como anomalía."""
        self._crear_mediciones_bulk(self._generar_datos_normales())
        ia.entrenar_modelo(self.tipo.id)

        m = Medicion.objects.create(sensor=self.sensor, valor=13.5)
        score, es_anomalia = ia.evaluar_medicion(m)
        self.assertIsNotNone(score)
        self.assertTrue(
            es_anomalia,
            f"Valor 13.5 debería ser anomalía (score={score})",
        )


class DeteccionRegistroTest(IABaseTestCase):

    def test_detectar_y_registrar_crea_anomalia(self):
        """detectar_y_registrar debe crear una Anomalia si detecta."""
        self._crear_mediciones_bulk(self._generar_datos_normales())
        ia.entrenar_modelo(self.tipo.id)

        m = Medicion.objects.create(sensor=self.sensor, valor=13.5)
        anomalia = ia.detectar_y_registrar(m)

        self.assertIsNotNone(anomalia)
        self.assertEqual(anomalia.cultivo, self.cultivo)
        self.assertEqual(anomalia.sensor, self.sensor)
        self.assertEqual(anomalia.medicion, m)
        self.assertGreater(anomalia.score, 0)
        self.assertEqual(anomalia.estado, Anomalia.Estado.NUEVA)

    def test_detectar_valor_normal_no_crea_anomalia(self):
        """Un valor normal no debe generar Anomalia."""
        self._crear_mediciones_bulk(self._generar_datos_normales())
        ia.entrenar_modelo(self.tipo.id)

        m = Medicion.objects.create(sensor=self.sensor, valor=6.05)
        anomalia = ia.detectar_y_registrar(m)

        self.assertIsNone(anomalia)
        self.assertEqual(Anomalia.objects.count(), 0)


class ManagementCommandTest(IABaseTestCase):

    def test_comando_corre_sin_datos(self):
        """El comando corre sin errores con base vacía."""
        out = StringIO()
        call_command("entrenar_modelos", stdout=out)
        output = out.getvalue()
        self.assertIn("ENTRENAMIENTO DE MODELOS DE IA", output)

    def test_comando_entrena_con_datos(self):
        """Con suficientes datos, el comando entrena el modelo."""
        self._crear_mediciones_bulk(self._generar_datos_normales())

        out = StringIO()
        call_command("entrenar_modelos", stdout=out)
        output = out.getvalue()

        self.assertIn("Entrenados OK:", output)


class SignalTest(IABaseTestCase):

    def test_signal_corre_sin_modelo_sin_romper(self):
        """La señal post_save corre incluso sin modelo entrenado."""
        # Si la señal rompiera, esto lanzaría excepción
        m = Medicion.objects.create(sensor=self.sensor, valor=6.0)
        self.assertEqual(Anomalia.objects.count(), 0)
        self.assertEqual(m.estado_lectura, "normal")