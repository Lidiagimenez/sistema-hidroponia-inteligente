"""
Señales del módulo eventos.

============================================================================
NOTA — DEUDA PENDIENTE
============================================================================
La lógica real de RF-20 (crear Alerta cuando se registra un Evento relevante)
ya está implementada en `apps/alertas/signals.py` (función `crear_alerta_por_evento`).

Este archivo queda como marcador estructural hasta que se decida si conviene
mover esa lógica acá (junto a los modelos de Evento) o dejarla donde está
(junto a los modelos de Alerta).

Las detecciones de RF-18, RF-31 y RF-32 NO se hacen por señal post_save
— se hacen por tarea programada (cron / Celery beat) usando los
management commands de `apps.eventos.management.commands.chequear_eventos`.
============================================================================
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.eventos.models import Evento


@receiver(post_save, sender=Evento, dispatch_uid="eventos.evaluar_evento")
def evaluar_evento(sender, instance, created, **kwargs):
    """
    Placeholder. La lógica real está en apps/alertas/signals.py.
    Se deja acá por consistencia estructural.
    """
    if not created:
        return
    pass