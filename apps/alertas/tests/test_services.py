from django.test import TestCase
from datetime import date, timedelta

from apps.alertas.services import calcular_severidad_por_desviacion, verificar_lecturas_consecutivas_y_generar_alerta
from apps.alertas.models import ParametroAlerta, Alerta
from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class SeveridadTest(TestCase):

    def test_severidad_alta(self):
        severidad = calcular_severidad_por_desviacion(valor=95, valor_min=20, valor_max=80, umbral_desviacion_alta=15)
        self.assertEqual(severidad, Alerta.Severidad.ALTA)

    def test_severidad_baja(self):
        severidad = calcular_severidad_por_desviacion(valor=81, valor_min=20, valor_max=80, umbral_desviacion_alta=30)
        self.assertEqual(severidad, Alerta.Severidad.BAJA)


class AntiFlappingTest(TestCase):

    def setUp(self):
        usuario = Usuario.objects.create_user(username="op_flap", password="test12345")
        cultivo = Cultivo.objects.create(nombre="Lechuga", fecha_creacion=date.today(), usuario=usuario)
        dispositivo = Dispositivo.objects.create(
            nombre="ESP32", tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="HW-FLAP", cultivo=cultivo,
        )
        self.tipo_sensor = TipoSensor.objects.create(
            nombre="Temp", unidad_medida="°C", valor_min_fisico=-10, valor_max_fisico=60,
        )
        self.sensor = Sensor.objects.create(dispositivo=dispositivo, tipo_sensor=self.tipo_sensor)
        RangoOperacion.objects.create(sensor=self.sensor, valor_min=18, valor_max=26)
        ParametroAlerta.objects.create(
            tipo_sensor=self.tipo_sensor, tiempo_maximo_sin_lectura=timedelta(minutes=10),
            lecturas_consecutivas_apertura=3, lecturas_consecutivas_cierre=3, umbral_desviacion_alta=30,
        )

    def test_no_abre_alerta_con_una_sola_lectura_fuera_de_rango(self):
        Medicion.objects.create(sensor=self.sensor, valor=35)
        self.assertEqual(Alerta.objects.count(), 0)

    def test_abre_alerta_con_tres_lecturas_consecutivas_fuera_de_rango(self):
        for _ in range(3):
            Medicion.objects.create(sensor=self.sensor, valor=35)
        self.assertEqual(Alerta.objects.filter(estado=Alerta.Estado.ACTIVA).count(), 1)