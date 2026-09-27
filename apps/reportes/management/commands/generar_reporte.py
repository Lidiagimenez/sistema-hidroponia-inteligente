from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError

from apps.reportes.models import Reporte
from apps.reportes.services import generar_reporte


class Command(BaseCommand):
    help = "Genera un reporte por línea de comandos"

    def add_arguments(self, parser):
        # Tipo de reporte: obligatorio, solo acepta los 6 definidos en el modelo
        parser.add_argument(
            "--tipo",
            required=True,
            choices=[t[0] for t in Reporte.Tipo.choices],
        )
        # Formato de salida
        parser.add_argument(
            "--formato",
            default="pdf",
            choices=[f[0] for f in Reporte.Formato.choices],
        )
        # Cultivo opcional (si no se pasa, el reporte es global)
        parser.add_argument("--cultivo", type=int, default=None)
        # Rango de fechas opcional (formato YYYY-MM-DD)
        parser.add_argument("--desde", default=None, help="YYYY-MM-DD")
        parser.add_argument("--hasta", default=None, help="YYYY-MM-DD")

    def handle(self, *args, **opts):
        # Si no se especifica --hasta, usa la fecha de hoy
        hasta = date.fromisoformat(opts["hasta"]) if opts["hasta"] else date.today()
        # Si no se especifica --desde, usa 7 días antes de hasta
        desde = date.fromisoformat(opts["desde"]) if opts["desde"] else hasta - timedelta(days=7)

        # Crea el registro del reporte en la base
        reporte = Reporte.objects.create(
            tipo=opts["tipo"],
            formato=opts["formato"],
            cultivo_id=opts["cultivo"],
            fecha_desde=desde,
            fecha_hasta=hasta,
        )
        generar_reporte(reporte)

        if reporte.estado == Reporte.Estado.ERROR:
            raise CommandError(f"Error: {reporte.error_detalle}")

        
        self.stdout.write(self.style.SUCCESS(
            f"Reporte generado: {reporte.archivo.url} ({reporte.total_registros} filas)"
        ))