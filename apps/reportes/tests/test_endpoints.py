from datetime import date, timedelta
from django.test import TestCase
from rest_framework.test import APIClient

from apps.usuarios.models import Usuario
from apps.reportes.models import Reporte


class ReporteEndpointsTest(TestCase):

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_rep", password="test12345",
            rol=Usuario.Rol.ADMINISTRADOR,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_crear_reporte_dispara_generacion(self):
        r = self.client.post("/api/reportes/", {
            "tipo": "alertas",
            "formato": "csv",
            "fecha_desde": str(date.today() - timedelta(days=7)),
            "fecha_hasta": str(date.today()),
        }, format="json")
        self.assertEqual(r.status_code, 201)
        reporte = Reporte.objects.first()
        self.assertEqual(reporte.estado, Reporte.Estado.LISTO)
        self.assertEqual(reporte.generado_por, self.admin)
        self.assertIsNotNone(reporte.archivo)

    def test_listar_reportes(self):
        r = self.client.get("/api/reportes/")
        self.assertEqual(r.status_code, 200)

    def test_regenerar_reporte(self):
        reporte = Reporte.objects.create(
            tipo="alertas",
            formato="csv",
            fecha_desde=date.today() - timedelta(days=7),
            fecha_hasta=date.today(),
        )
        r = self.client.post(f"/api/reportes/{reporte.id}/regenerar/")
        self.assertEqual(r.status_code, 200)
        reporte.refresh_from_db()
        self.assertEqual(reporte.estado, Reporte.Estado.LISTO)