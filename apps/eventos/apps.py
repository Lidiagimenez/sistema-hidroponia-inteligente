from django.apps import AppConfig


class EventosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.eventos"

    def ready(self):
        import apps.eventos.signals  # noqa: F401