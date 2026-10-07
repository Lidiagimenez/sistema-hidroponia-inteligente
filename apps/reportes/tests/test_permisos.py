from datetime import date, timedelta

from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario
from apps.cultivos.models import Cultivo
from apps.reportes.models import Reporte


class ReportesPermisosTest(APITestCase):

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
        self.reporte = Reporte.objects.create(
            tipo="monitoreo",
            formato="pdf",
            cultivo=self.cultivo,
            fecha_desde=date.today() - timedelta(days=7),
            fecha_hasta=date.today(),
            generado_por=self.admin,
            estado="listo",
        )

    # --- Lectura: ambos ---

    def test_operador_puede_ver_reportes(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/reportes/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_ver_reportes(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/reportes/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    # --- Crear: solo admin ---

    def test_operador_no_puede_crear_reporte(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/reportes/", {
            "tipo": "monitoreo",
            "formato": "pdf",
            "cultivo": self.cultivo.pk,
            "fecha_desde": str(date.today() - timedelta(days=7)),
            "fecha_hasta": str(date.today()),
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    # --- Regenerar: solo admin ---

    def test_operador_no_puede_regenerar(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post(f"/api/reportes/{self.reporte.pk}/regenerar/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_si_puede_regenerar(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(f"/api/reportes/{self.reporte.pk}/regenerar/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    # --- PUT y PATCH bloqueados ---

    def test_nadie_puede_hacer_put(self):
        self.client.force_authenticate(self.admin)
        r = self.client.put(f"/api/reportes/{self.reporte.pk}/", {
            "tipo": "alertas",
            "formato": "pdf",
            "fecha_desde": str(date.today()),
            "fecha_hasta": str(date.today()),
        })
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_nadie_puede_hacer_patch(self):
        self.client.force_authenticate(self.admin)
        r = self.client.patch(f"/api/reportes/{self.reporte.pk}/", {
            "tipo": "alertas",
        })
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    # --- Borrar: solo admin ---

    def test_operador_no_puede_borrar_reporte(self):
        self.client.force_authenticate(self.operador)
        r = self.client.delete(f"/api/reportes/{self.reporte.pk}/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)