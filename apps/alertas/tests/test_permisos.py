from datetime import date

from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario
from apps.cultivos.models import Cultivo
from apps.dispositivos.models import Dispositivo
from apps.eventos.models import Evento
from apps.alertas.models import Alerta


class AlertasPermisosTest(APITestCase):

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

    # --- Lectura ---

    def test_operador_puede_ver_alertas(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/alertas/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_ver_alertas(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/alertas/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    # --- PATCH: marcar como resuelta ---

    def test_operador_puede_marcar_alerta_como_resuelta(self):
        self.client.force_authenticate(self.operador)
        r = self.client.patch(
            f"/api/alertas/{self.alerta.pk}/",
            {"estado": "resuelta"},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.alerta.refresh_from_db()
        self.assertEqual(self.alerta.estado, "resuelta")
        self.assertIsNotNone(self.alerta.fecha_hora_fin)

    def test_admin_puede_marcar_alerta_como_resuelta(self):
        self.client.force_authenticate(self.admin)
        r = self.client.patch(
            f"/api/alertas/{self.alerta.pk}/",
            {"estado": "resuelta"},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_no_se_puede_cambiar_otro_campo(self):
        """Solo se puede modificar 'estado'. Cualquier otro campo → 400."""
        self.client.force_authenticate(self.operador)
        r = self.client.patch(
            f"/api/alertas/{self.alerta.pk}/",
            {"severidad": "alta"},
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_estado_invalido_da_400(self):
        self.client.force_authenticate(self.operador)
        r = self.client.patch(
            f"/api/alertas/{self.alerta.pk}/",
            {"estado": "inventado"},
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # --- No se puede crear, actualizar completo ni borrar ---

    def test_nadie_puede_crear_alerta_por_api(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/alertas/", {
            "evento": self.evento.pk,
            "severidad": "alta",
        })
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_nadie_puede_borrar_alerta(self):
        self.client.force_authenticate(self.admin)
        r = self.client.delete(f"/api/alertas/{self.alerta.pk}/")
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    # --- ParametroAlerta: solo admin ---

    def test_operador_no_puede_ver_parametros_alerta(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/parametros-alerta/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_si_puede_ver_parametros_alerta(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/parametros-alerta/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)