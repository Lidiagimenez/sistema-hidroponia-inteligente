from django.contrib import admin
from apps.reportes.models import Reporte


@admin.register(Reporte)
class ReporteAdmin(admin.ModelAdmin):
    # Columnas que se ven en el listado del admin
    list_display = (
        "id", "tipo", "formato", "cultivo", "estado",
        "fecha_solicitud", "total_registros",
    )
    # Filtros laterales
    list_filter = ("tipo", "formato", "estado")
    # Búsqueda por texto
    search_fields = ("cultivo__nombre",)
    # Campos de solo lectura (no se pueden editar desde el admin)
    readonly_fields = (
        "fecha_solicitud", "fecha_generacion",
        "archivo", "error_detalle", "total_registros",
    )
    # Barra de navegación por fecha arriba
    date_hierarchy = "fecha_solicitud"