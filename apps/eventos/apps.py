from django.apps import AppConfig


class EventosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.eventos"
    verbose_name = "Eventos"

    # Nota: la creación de Alertas a partir de Eventos (RF-20) vive en
    # apps/alertas/signals.py. Las detecciones periódicas (RF-18, RF-31, RF-32)
    # corren con el comando `chequear_eventos` (ver `planificador`).
