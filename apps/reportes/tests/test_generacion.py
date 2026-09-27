from datetime import date, timedelta
from django.test import TestCase

from apps.reportes.models import Reporte
from apps.reportes.services import generar_reporte


class ReporteGeneracionTest(TestCase):

    def _crear(self, tipo, formato):
        return Reporte.objects.create(
            tipo=tipo,
            formato=formato,
            fecha_desde=date.today() - timedelta(days=7),
            fecha_hasta=date.today(),
        )

    def test_reporte_alertas_csv(self):
        r = self._crear(Reporte.Tipo.ALERTAS, Reporte.Formato.CSV)
        generar_reporte(r)
        r.refresh_from_db()
        self.assertEqual(r.estado, Reporte.Estado.LISTO)
        self.assertIsNotNone(r.archivo)
        self.assertTrue(r.archivo.name.endswith(".csv"))

    def test_reporte_monitoreo_pdf(self):
        r = self._crear(Reporte.Tipo.MONITOREO, Reporte.Formato.PDF)
        generar_reporte(r)
        r.refresh_from_db()
        self.assertEqual(r.estado, Reporte.Estado.LISTO)
        self.assertTrue(r.archivo.name.endswith(".pdf"))

    def test_reporte_eventos_excel(self):
        r = self._crear(Reporte.Tipo.EVENTOS, Reporte.Formato.EXCEL)
        generar_reporte(r)
        r.refresh_from_db()
        self.assertEqual(r.estado, Reporte.Estado.LISTO)
        self.assertTrue(r.archivo.name.endswith(".xlsx"))

    def test_reporte_crecimiento_csv(self):
        r = self._crear(Reporte.Tipo.CRECIMIENTO, Reporte.Formato.CSV)
        generar_reporte(r)
        r.refresh_from_db()
        self.assertEqual(r.estado, Reporte.Estado.LISTO)

    def test_reporte_intervenciones_csv(self):
        r = self._crear(Reporte.Tipo.INTERVENCIONES, Reporte.Formato.CSV)
        generar_reporte(r)
        r.refresh_from_db()
        self.assertEqual(r.estado, Reporte.Estado.LISTO)

    def test_reporte_recomendaciones_csv(self):
        r = self._crear(Reporte.Tipo.RECOMENDACIONES, Reporte.Formato.CSV)
        generar_reporte(r)
        r.refresh_from_db()
        self.assertEqual(r.estado, Reporte.Estado.LISTO)

    def test_tipo_invalido_marca_error(self):
        r = self._crear("tipo_inexistente", Reporte.Formato.CSV)
        generar_reporte(r)
        r.refresh_from_db()
        self.assertEqual(r.estado, Reporte.Estado.ERROR)
        self.assertTrue(r.error_detalle)