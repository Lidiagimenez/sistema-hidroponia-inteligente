from datetime import date
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.utils import timezone

from apps.alertas.models import Alerta
from apps.cultivos.models import CicloProduccion
from apps.monitoreo.models import TipoSensor, Sensor, Medicion
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class IntervencionAPITest(APITestCase):

    def setUp(self):
        self.operador = Usuario.objects.create_user(username="op_api", password="test12345", rol=Usuario.Rol.OPERADOR)
        self.cultivo = Cultivo.objects.create(nombre="Lechuga", fecha_creacion=date.today(), usuario=self.operador)
        self.ciclo = CicloProduccion.objects.create(cultivo=self.cultivo, fecha_inicio=date.today())
        dispositivo = Dispositivo.objects.create(
            nombre="ESP32", tipo_dispositivo=Dispositivo.TipoDispositivo.SENSOR,
            identificador_hardware="HW-INTAPI", cultivo=self.cultivo,
        )
        tipo_sensor = TipoSensor.objects.create(nombre="Temp", unidad_medida="°C", valor_min_fisico=-10, valor_max_fisico=60)
        sensor = Sensor.objects.create(dispositivo=dispositivo, tipo_sensor=tipo_sensor)
        medicion = Medicion.objects.create(sensor=sensor, valor=99)
        self.alerta = Alerta.objects.create(medicion=medicion, severidad=Alerta.Severidad.ALTA)
        self.client.force_authenticate(user=self.operador)

    def test_operador_crea_intervencion(self):
        url = reverse("intervencion-list")
        data = {
            "alerta": self.alerta.id,
            "tipo": "mantenimiento",
            "observaciones": "Se ajustó el sensor.",
            "descripcion_accion": "Ajuste manual del soporte.",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["operador"], self.operador.id)

    def test_crea_intervencion_con_cultivo(self):
        url = reverse("intervencion-list")
        data = {
            "cultivo": self.cultivo.id_cultivo,
            "tipo": "tratamiento",
            "observaciones": "Aplicación preventiva.",
            "descripcion_accion": "Tratamiento foliar.",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["cultivo"], self.cultivo.id_cultivo)

    def test_crea_intervencion_con_ciclo(self):
        url = reverse("intervencion-list")
        data = {
            "ciclo": self.ciclo.id_ciclo,
            "tipo": "ajuste_parametros",
            "observaciones": "Ajuste de nutrientes.",
            "descripcion_accion": "Se redujo conductividad.",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["ciclo"], self.ciclo.id_ciclo)

    def test_crea_intervencion_cosecha(self):
        url = reverse("intervencion-list")
        data = {
            "ciclo": self.ciclo.id_ciclo,
            "tipo": "cosecha",
            "observaciones": "Cosecha en buen estado.",
            "descripcion_accion": "Cosecha manual.",
            "fecha_cosecha_real": timezone.now().isoformat(),
            "resultado_cosecha": "exitosa",
            "cantidad_cosechada_kg": "2.50",
        }
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["resultado_cosecha"], "exitosa")

    def test_rechaza_intervencion_sin_origen(self):
        url = reverse("intervencion-list")
        data = {
            "tipo": "mantenimiento",
            "observaciones": "Sin origen.",
            "descripcion_accion": "No debería aceptarse.",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
