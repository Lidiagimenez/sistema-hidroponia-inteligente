from django.apps import AppConfig


class InteligenciaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.inteligencia"
    verbose_name = "Inteligencia"

    def ready(self):
        """Registra las señales del módulo al iniciar Django."""
        from . import signals  # noqa: F401