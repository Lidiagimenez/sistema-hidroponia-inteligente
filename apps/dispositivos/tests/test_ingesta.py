from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase

from apps.cultivos.models import Cultivo
from apps.dispositivos.models import Dispositivo
from apps.monitoreo.models import Medicion, Sensor, TipoSensor
from apps.usuarios.models import Usuario

URL_INGESTA = "/api/ingesta/mediciones/"


class IngestaBase(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_ing", password="test12345", rol=Usuario.Rol.ADMINISTRADOR
        )
        self.operador = Usuario.objects.create_user(
            username="op_ing", password="test12345", rol=Usuario.Rol.OPERADOR
        )
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga", fecha_creacion=date.today(), usuario=self.admin
        )
        self.dispositivo = Dispositivo.objects.create(
            nombre="ESP32-A", tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="HW-ING-1", cultivo=self.cultivo,
        )
        self.otro_dispositivo = Dispositivo.objects.create(
            nombre="ESP32-B", tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="HW-ING-2", cultivo=self.cultivo,
        )
        self.tipo = TipoSensor.objects.create(
            nombre="pH", unidad_medida="pH", valor_min_fisico=0, valor_max_fisico=14
        )
        self.sensor = Sensor.objects.create(dispositivo=self.dispositivo, tipo_sensor=self.tipo)
        self.sensor_ajeno = Sensor.objects.create(dispositivo=self.otro_dispositivo, tipo_sensor=self.tipo)
        self.clave = self.dispositivo.generar_api_key()


class ApiKeyTest(IngestaBase):
    def test_admin_regenera_api_key(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(f"/api/dispositivos/{self.dispositivo.id}/regenerar-api-key/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("api_key", r.data)
        self.assertNotEqual(r.data["api_key"], self.clave)

    def test_operador_no_regenera_api_key(self):
        self.client.force_authenticate(user=self.operador)
        r = self.client.post(f"/api/dispositivos/{self.dispositivo.id}/regenerar-api-key/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_key_no_se_expone_en_listado(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get("/api/dispositivos/")
        self.assertNotIn("api_key", str(r.data))
        self.assertNotIn("api_key_hash", str(r.data))

    def test_clave_se_guarda_hasheada(self):
        self.dispositivo.refresh_from_db()
        self.assertNotEqual(self.dispositivo.api_key_hash, self.clave)
        self.assertEqual(len(self.dispositivo.api_key_hash), 64)

    def test_clave_anterior_deja_de_valer_al_regenerar(self):
        self.dispositivo.generar_api_key()
        r = self.client.post(URL_INGESTA, {"sensor": self.sensor.id, "valor": 6.5},
                             format="json", HTTP_X_API_KEY=self.clave)
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


class IngestaMedicionTest(IngestaBase):
    def test_ingesta_correcta(self):
        r = self.client.post(URL_INGESTA, {"sensor": self.sensor.id, "valor": 6.5},
                             format="json", HTTP_X_API_KEY=self.clave)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Medicion.objects.count(), 1)
        self.assertEqual(r.data["estado_lectura"], "normal")

    def test_valor_fuera_de_rango_fisico_queda_marcado(self):
        r = self.client.post(URL_INGESTA, {"sensor": self.sensor.id, "valor": 99},
                             format="json", HTTP_X_API_KEY=self.clave)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["estado_lectura"], "fuera_rango")

    def test_sin_api_key_es_401(self):
        r = self.client.post(URL_INGESTA, {"sensor": self.sensor.id, "valor": 6.5}, format="json")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_api_key_invalida_es_401(self):
        r = self.client.post(URL_INGESTA, {"sensor": self.sensor.id, "valor": 6.5},
                             format="json", HTTP_X_API_KEY="clave-falsa")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dispositivo_inactivo_es_401(self):
        self.dispositivo.estado = Dispositivo.Estado.INACTIVO
        self.dispositivo.save()
        r = self.client.post(URL_INGESTA, {"sensor": self.sensor.id, "valor": 6.5},
                             format="json", HTTP_X_API_KEY=self.clave)
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_no_puede_cargar_sensor_de_otro_dispositivo(self):
        r = self.client.post(URL_INGESTA, {"sensor": self.sensor_ajeno.id, "valor": 6.5},
                             format="json", HTTP_X_API_KEY=self.clave)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Medicion.objects.count(), 0)

    def test_valor_no_numerico_es_400(self):
        r = self.client.post(URL_INGESTA, {"sensor": self.sensor.id, "valor": "abc"},
                             format="json", HTTP_X_API_KEY=self.clave)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_usuario_jwt_no_puede_usar_endpoint_de_dispositivos(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(URL_INGESTA, {"sensor": self.sensor.id, "valor": 6.5}, format="json")
        self.assertIn(r.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertEqual(Medicion.objects.count(), 0)

    def test_personas_no_pueden_editar_ni_borrar_mediciones(self):
        self.client.post(URL_INGESTA, {"sensor": self.sensor.id, "valor": 6.5},
                         format="json", HTTP_X_API_KEY=self.clave)
        medicion = Medicion.objects.first()
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.delete(f"/api/mediciones/{medicion.id}/").status_code,
                         status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(self.client.post("/api/mediciones/", {"sensor": self.sensor.id, "valor": 1},
                                          format="json").status_code,
                         status.HTTP_405_METHOD_NOT_ALLOWED)
