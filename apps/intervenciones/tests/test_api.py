from datetime import date
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

from apps.alertas.models import Alerta
from apps.monitoreo.models import TipoSensor, Sensor, Medicion
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class IntervencionAPITest(APITestCase):

    def setUp(self):
        self.operador = Usuario.objects.create_user(username="op_api", password="test12345", rol=Usuario.Rol.OPERADOR)
        cultivo = Cultivo.objects.create(nombre="Lechuga", fecha_creacion=date.today(), usuario=self.operador)
        dispositivo = Dispositivo.objects.create(
            nombre="ESP32", tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="HW-INTAPI", cultivo=cultivo,
        )
        tipo_sensor = TipoSensor.objects.create(nombre="Temp", unidad_medida="°C", valor_min_fisico=-10, valor_max_fisico=60)
        sensor = Sensor.objects.create(dispositivo=dispositivo, tipo_sensor=tipo_sensor)
        medicion = Medicion.objects.create(sensor=sensor, valor=99)
        self.alerta = Alerta.objects.create(medicion=medicion, severidad=Alerta.Severidad.ALTA)
        self.client.force_authenticate(user=self.operador)

    def test_operador_crea_intervencion(self):
        url = reverse("intervencion-list")
        data = {"alerta": self.alerta.id, "observaciones": "Se ajustó el sensor."}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["operador"], self.operador.id)