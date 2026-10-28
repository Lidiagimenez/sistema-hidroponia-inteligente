from django.contrib import admin

from apps.auditoria.models import RegistroAuditoria


@admin.register(RegistroAuditoria)
class RegistroAuditoriaAdmin(admin.ModelAdmin):
    """
    Solo lectura: los registros de auditoría no se editan ni se borran desde
    acá (mismo criterio que el ViewSet). Solo el panel interno en desarrollo.
    """
    list_display = ("fecha_hora", "usuario", "accion", "entidad", "objeto_id", "ip_address")
    list_filter = ("accion", "entidad")
    search_fields = ("usuario__username", "entidad", "detalles")
    date_hierarchy = "fecha_hora"
    readonly_fields = [f.name for f in RegistroAuditoria._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False