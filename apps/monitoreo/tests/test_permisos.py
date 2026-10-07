from datetime import date

from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario
from apps.cultivos.models import Cultivo
from apps.dispositivos.models import Dispositivo
from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion


class MonitoreoPermisosTest(APITestCase):

    def setUp(self):
        self.operador = Usuario.objects.create_user(
            username="op_test", password="test1234", rol="operador"
        )
        self.admin = Usuario.objects.create_user(
            username="adm_test", password="test1234", rol="administrador"
        )

        # Cultivo → Dispositivo → Sensor → TipoSensor (cadena obligatoria)
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga test",
            fecha_creacion=date.today(),
            usuario=self.admin,
        )
        self.dispositivo = Dispositivo.objects.create(
            nombre="ESP32 test",
            tipo_dispositivo="sensor",
            identificador_hardware="ESP-TEST-001",
            cultivo=self.cultivo,
        )
        self.tipo_sensor = TipoSensor.objects.create(
            nombre="pH",
            unidad_medida="pH",
            valor_min_fisico=0.0,
            valor_max_fisico=14.0,
        )
        self.sensor = Sensor.objects.create(
            dispositivo=self.dispositivo,
            tipo_sensor=self.tipo_sensor,
        )
        self.rango = RangoOperacion.objects.create(
            sensor=self.sensor,
            valor_min=5.5,
            valor_max=7.5,
        )

    # --- TipoSensor ---

    def test_operador_puede_ver_tipos_sensor(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/tipos-sensor/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_operador_no_puede_crear_tipo_sensor(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/tipos-sensor/", {
            "nombre": "Nuevo", "unidad_medida": "x",
            "valor_min_fisico": 0, "valor_max_fisico": 10,
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_si_puede_crear_tipo_sensor(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/tipos-sensor/", {
            "nombre": "Nuevo", "unidad_medida": "x",
            "valor_min_fisico": 0, "valor_max_fisico": 10,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # --- RangoOperacion ---

    def test_operador_no_puede_crear_rango(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/rangos-operacion/", {
            "sensor": self.sensor.pk, "valor_min": 5.0, "valor_max": 8.0,
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_si_puede_crear_rango(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/rangos-operacion/", {
            "sensor": self.sensor.pk, "valor_min": 5.0, "valor_max": 8.0,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # --- Medicion (solo lectura) ---

    def test_operador_puede_ver_mediciones(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/mediciones/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_operador_no_puede_crear_medicion_por_api_normal(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/mediciones/", {
            "sensor": self.sensor.pk, "valor": 6.5,
        })
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)