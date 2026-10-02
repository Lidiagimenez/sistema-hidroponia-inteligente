"""
Señales del módulo inteligencia.

Cuando se guarda una nueva Medicion, se evalúa automáticamente contra
el modelo de IA (Isolation Forest) para ese tipo de sensor. Si el modelo
detecta una anomalía, se registra un objeto Anomalia.

Flujo completo de una medición:

    1. apps.monitoreo.signals.validar_medicion
       → calcula `estado_lectura` (normal / fuera_rango).

    2. apps.alertas.signals.evaluar_alerta_por_medicion
       → abre o cierra Alertas según las reglas duras.

    3. apps.inteligencia.signals.detectar_anomalia_en_medicion  ← ESTA SEÑAL
       → evalúa con IA y registra Anomalia si corresponde.

Orden garantizado por el orden de INSTALLED_APPS:
    monitoreo → eventos → alertas → intervenciones → inteligencia

La señal está diseñada para NO romper el guardado de la medición:
  - Se ejecuta solo en `created=True` (mediciones nuevas).
  - Si no hay modelo entrenado para el tipo de sensor, no hace nada.
  - Cualquier excepción se captura y se loguea, sin propagarse.

Esto es importante: la inteligencia es un complemento, no debe
bloquear la recepción de datos del hardware.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver


logger = logging.getLogger(__name__)


@receiver(
    post_save,
    sender="monitoreo.Medicion",
    dispatch_uid="inteligencia.detectar_anomalia_en_medicion",
)
def detectar_anomalia_en_medicion(sender, instance, created, **kwargs):
    """
    Evalúa una medición recién creada contra el modelo de IA.
    Si detecta una anomalía, la registra.

    Se importa `ia` dentro de la función para evitar imports circulares
    al cargar la app durante el arranque de Django.
    """
    if not created:
        return

    # Solo evaluamos mediciones de sensores que tienen tipo_sensor
    # (siempre lo tienen, pero por las dudas)
    if not instance.sensor_id:
        return

    try:
        from apps.inteligencia.ia import detectar_y_registrar

        anomalia = detectar_y_registrar(instance)

        if anomalia is not None:
            logger.info(
                "Anomalía detectada en medición %s: sensor=%s valor=%s score=%.2f",
                instance.pk,
                instance.sensor_id,
                instance.valor,
                anomalia.score,
            )
    except Exception as exc:
        # NUNCA propagar el error: si la IA falla, la medición ya se guardó
        # y no queremos romper el flujo del hardware.
        logger.exception(
            "Error evaluando IA para medición %s: %s",
            instance.pk,
            exc,
        )