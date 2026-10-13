from datetime import date

from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario
from apps.cultivos.models import Cultivo
from apps.eventos.models import Evento
from apps.alertas.models import Alerta
from apps.intervenciones.models import Intervencion


class IntervencionesPermisosTest(APITestCase):

    def setUp(self):
        self.operador = Usuario.objects.create_user(
            username="op_test", password="test1234", rol="operador"
        )
        self.admin = Usuario.objects.create_user(
            username="adm_test", password="test1234", rol="administrador"
        )
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga test",
            fecha_creacion=date.today(),
            usuario=self.admin,
        )
        self.evento = Evento.objects.create(
            tipo_evento="sensor_sin_comunicacion",
            cultivo=self.cultivo,
        )
        self.alerta = Alerta.objects.create(
            evento=self.evento,
            severidad="media",
            estado="activa",
        )
        self.intervencion = Intervencion.objects.create(
            alerta=self.alerta,
            operador=self.operador,
            observaciones="Revisé el sensor, estaba flojo el cable",
        )

    # --- Lectura: ambos roles ---

    def test_operador_puede_ver_intervenciones(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/intervenciones/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_ver_intervenciones(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/intervenciones/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    # --- Crear: admin y operador ---

    def test_operador_puede_crear_intervencion(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/intervenciones/", {
            "alerta": self.alerta.pk,
            "tipo": "mantenimiento",
            "observaciones": "Nueva intervención",
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["operador"], self.operador.pk)

    def test_admin_puede_crear_intervencion(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/intervenciones/", {
            "alerta": self.alerta.pk,
            "tipo": "mantenimiento",
            "observaciones": "Nueva intervención",
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["operador"], self.admin.pk)

    def test_operador_no_puede_crear_tipo_no_permitido(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/intervenciones/", {
            "alerta": self.alerta.pk,
            "tipo": "siembra",
            "observaciones": "No permitido para operador.",
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # --- Editar (PATCH): admin y operador ---

    def test_operador_puede_editar_intervencion(self):
        self.client.force_authenticate(self.operador)
        r = self.client.patch(
            f"/api/intervenciones/{self.intervencion.pk}/",
            {"observaciones": "Observación actualizada"},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.intervencion.refresh_from_db()
        self.assertEqual(self.intervencion.observaciones, "Observación actualizada")

    def test_admin_puede_editar_intervencion_sin_cambiar_observaciones(self):
        self.client.force_authenticate(self.admin)
        r = self.client.patch(
            f"/api/intervenciones/{self.intervencion.pk}/",
            {"resuelta": True, "observaciones": "No debería cambiar"},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.intervencion.refresh_from_db()
        self.assertTrue(self.intervencion.resuelta)
        self.assertEqual(self.intervencion.observaciones, "Revisé el sensor, estaba flojo el cable")

    # --- PUT bloqueado; DELETE solo admin ---

    def test_nadie_puede_hacer_put(self):
        self.client.force_authenticate(self.operador)
        r = self.client.put(
            f"/api/intervenciones/{self.intervencion.pk}/",
            {"alerta": self.alerta.pk, "observaciones": "X"},
        )
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_operador_no_puede_borrar_intervencion(self):
        self.client.force_authenticate(self.operador)
        r = self.client.delete(f"/api/intervenciones/{self.intervencion.pk}/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_borrar_intervencion(self):
        self.client.force_authenticate(self.admin)
        r = self.client.delete(f"/api/intervenciones/{self.intervencion.pk}/")
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
