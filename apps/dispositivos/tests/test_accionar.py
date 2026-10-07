from datetime import date

from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario
from apps.cultivos.models import Cultivo
from apps.dispositivos.models import Dispositivo


class AccionarDispositivoTest(APITestCase):

    def setUp(self):
        self.operador = Usuario.objects.create_user(
            username="op_test", password="test1234", rol="operador"
        )
        self.admin = Usuario.objects.create_user(
            username="adm_test", password="test1234", rol="administrador"
        )
        # Necesitamos un cultivo primero (Dispositivo lo requiere)
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga test",
            fecha_creacion=date.today(),
            usuario=self.admin,
        )
        self.bomba = Dispositivo.objects.create(
            nombre="Bomba 1",
            tipo_dispositivo="bomba",
            identificador_hardware="BOMBA-TEST-001",
            cultivo=self.cultivo,
        )

    def test_operador_no_puede_crear_dispositivo(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/dispositivos/", {
            "nombre": "Bomba 2",
            "tipo_dispositivo": "bomba",
            "identificador_hardware": "BOMBA-TEST-002",
            "cultivo": self.cultivo.pk,
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_operador_puede_accionar_bomba(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post(
            f"/api/dispositivos/{self.bomba.pk}/accionar/",
            {"accion": "encender"},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_tambien_puede_accionar(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            f"/api/dispositivos/{self.bomba.pk}/accionar/",
            {"accion": "apagar"},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_accionar_con_valor_invalido(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            f"/api/dispositivos/{self.bomba.pk}/accionar/",
            {"accion": "explotar"},
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)