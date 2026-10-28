from django.apps import AppConfig


class AuditoriaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.auditoria"
    verbose_name = "Auditoría"

    # Nota: sistema paralelo a apps/eventos. Eventos = hardware
    # (sensores, energía, bombas). Auditoria = acciones de usuarios
    # (login, CREAR/EDITAR/ELIMINAR sobre datos del sistema).