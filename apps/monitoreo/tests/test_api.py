from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase

from apps.cultivos.models import Cultivo
from apps.dispositivos.models import Dispositivo
from apps.monitoreo.models import Sensor, TipoSensor
from apps.usuarios.models import Usuario


class MonitoreoApiTest(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_mon", password="test12345", rol=Usuario.Rol.ADMINISTRADOR
        )
        self.operador = Usuario.objects.create_user(
            username="op_mon", password="test12345", rol=Usuario.Rol.OPERADOR
        )
        cultivo = Cultivo.objects.create(nombre="Lechuga", fecha_creacion=date.today(), usuario=self.admin)
        disp = Dispositivo.objects.create(
            nombre="ESP32", tipo_dispositivo="sensor", identificador_hardware="HW-MON", cultivo=cultivo
        )
        self.tipo = TipoSensor.objects.create(
            nombre="Temperatura", unidad_medida="°C", valor_min_fisico=-10, valor_max_fisico=60
        )
        self.sensor = Sensor.objects.create(dispositivo=disp, tipo_sensor=self.tipo)

    def test_sin_login_es_401(self):
        for ruta in ("tipos-sensor", "sensores", "rangos-operacion", "mediciones", "imagenes"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(f"/api/{ruta}/").status_code,
                                 status.HTTP_401_UNAUTHORIZED)

    def test_operador_puede_listar(self):
        self.client.force_authenticate(user=self.operador)
        for ruta in ("tipos-sensor", "sensores", "rangos-operacion", "mediciones", "imagenes"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(f"/api/{ruta}/").status_code, status.HTTP_200_OK)

    def test_operador_no_puede_crear_tipo_sensor(self):
        self.client.force_authenticate(user=self.operador)
        r = self.client.post("/api/tipos-sensor/", {
            "nombre": "pH", "unidad_medida": "pH", "valor_min_fisico": 0, "valor_max_fisico": 14,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_crea_tipo_sensor(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post("/api/tipos-sensor/", {
            "nombre": "pH", "unidad_medida": "pH", "valor_min_fisico": 0, "valor_max_fisico": 14,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_admin_crea_rango_de_operacion(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post("/api/rangos-operacion/", {
            "sensor": self.sensor.pk, "valor_min": 18, "valor_max": 26,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_operador_no_puede_borrar_sensor(self):
        self.client.force_authenticate(user=self.operador)
        self.assertEqual(self.client.delete(f"/api/sensores/{self.sensor.pk}/").status_code,
                         status.HTTP_403_FORBIDDEN)
