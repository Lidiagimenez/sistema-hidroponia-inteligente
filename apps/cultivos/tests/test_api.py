from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase

from apps.cultivos.models import CicloProduccion, Cultivo
from apps.usuarios.models import Usuario


class CultivoApiTest(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_cult", password="test12345", rol=Usuario.Rol.ADMINISTRADOR
        )
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga", fecha_creacion=date.today(), usuario=self.admin
        )
        self.client.force_authenticate(user=self.admin)

    def test_listar_cultivos(self):
        r = self.client.get("/api/cultivos/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data["count"], 1)

    def test_crear_cultivo_asigna_usuario_autenticado(self):
        r = self.client.post("/api/cultivos/", {
            "nombre": "Albahaca", "tipo_cultivo": "Aromática",
            "fecha_creacion": str(date.today()),
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Cultivo.objects.get(nombre="Albahaca").usuario, self.admin)

    def test_no_se_puede_crear_cultivo_a_nombre_de_otro(self):
        otro = Usuario.objects.create_user(username="otro_cult", password="test12345")
        r = self.client.post("/api/cultivos/", {
            "nombre": "Rúcula", "fecha_creacion": str(date.today()), "usuario": otro.pk,
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Cultivo.objects.get(nombre="Rúcula").usuario, self.admin)

    def test_crear_cultivo_sin_nombre_es_400(self):
        r = self.client.post("/api/cultivos/", {"fecha_creacion": str(date.today())}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_y_listar_ciclos(self):
        r = self.client.post("/api/ciclos-produccion/", {
            "cultivo": self.cultivo.pk, "fecha_inicio": str(date.today()),
        }, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CicloProduccion.objects.get().estado, "germinacion")
        self.assertEqual(self.client.get("/api/ciclos-produccion/").data["count"], 1)
