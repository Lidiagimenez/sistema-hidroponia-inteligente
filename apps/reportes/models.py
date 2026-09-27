from django.conf import settings
from django.db import models


class Reporte(models.Model):
    # Tipos de reporte disponibles (6 opciones cerradas)
    class Tipo(models.TextChoices):
        MONITOREO = "monitoreo", "Monitoreo de sensores"
        ALERTAS = "alertas", "Historial de alertas"
        EVENTOS = "eventos", "Historial de eventos"
        CRECIMIENTO = "crecimiento", "Crecimiento del cultivo"
        INTERVENCIONES = "intervenciones", "Intervenciones"
        RECOMENDACIONES = "recomendaciones", "Recomendaciones"

    # Formatos de salida posibles
    class Formato(models.TextChoices):
        PDF = "pdf", "PDF"
        EXCEL = "xlsx", "Excel"
        CSV = "csv", "CSV"

    # Ciclo de vida del reporte
    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        GENERANDO = "generando", "Generando"
        LISTO = "listo", "Listo"
        ERROR = "error", "Error"

    # Qué pidió el usuario
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    formato = models.CharField(max_length=5, choices=Formato.choices, default=Formato.PDF)
    cultivo = models.ForeignKey(
        "cultivos.Cultivo", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="reportes",
    )  # SET_NULL: si borran el cultivo, el reporte no se pierde
    fecha_desde = models.DateField()
    fecha_hasta = models.DateField()

    # Resultado
    archivo = models.FileField(upload_to="reportes/%Y/%m/", null=True, blank=True)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    error_detalle = models.TextField(blank=True)
    total_registros = models.PositiveIntegerField(default=0)

    # Auditoría
    generado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="reportes_generados",
    )  # SET_NULL: el reporte sobrevive aunque borren al usuario
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    fecha_generacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-fecha_solicitud"]  # más nuevos primero
        verbose_name = "Reporte"
        verbose_name_plural = "Reportes"

    def __str__(self):
        return f"Reporte({self.get_tipo_display()} {self.fecha_desde}→{self.fecha_hasta})"