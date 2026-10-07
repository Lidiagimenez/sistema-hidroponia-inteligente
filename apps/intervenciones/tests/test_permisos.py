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

    # --- Crear: solo operador ---

    def test_operador_puede_crear_intervencion(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/intervenciones/", {
            "alerta": self.alerta.pk,
            "observaciones": "Nueva intervención",
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["operador"], self.operador.pk)

    def test_admin_no_puede_crear_intervencion(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/intervenciones/", {
            "alerta": self.alerta.pk,
            "observaciones": "Nueva intervención",
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    # --- Editar (PATCH): solo operador ---

    def test_operador_puede_editar_intervencion(self):
        self.client.force_authenticate(self.operador)
        r = self.client.patch(
            f"/api/intervenciones/{self.intervencion.pk}/",
            {"observaciones": "Observación actualizada"},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.intervencion.refresh_from_db()
        self.assertEqual(self.intervencion.observaciones, "Observación actualizada")

    def test_admin_no_puede_editar_intervencion(self):
        self.client.force_authenticate(self.admin)
        r = self.client.patch(
            f"/api/intervenciones/{self.intervencion.pk}/",
            {"observaciones": "No debería poder"},
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    # --- PUT y DELETE bloqueados para todos ---

    def test_nadie_puede_hacer_put(self):
        self.client.force_authenticate(self.operador)
        r = self.client.put(
            f"/api/intervenciones/{self.intervencion.pk}/",
            {"alerta": self.alerta.pk, "observaciones": "X"},
        )
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_nadie_puede_borrar_intervencion(self):
        self.client.force_authenticate(self.admin)
        r = self.client.delete(f"/api/intervenciones/{self.intervencion.pk}/")
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)