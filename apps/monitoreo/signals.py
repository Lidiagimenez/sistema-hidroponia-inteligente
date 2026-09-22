from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.monitoreo.models import Medicion


@receiver(post_save, sender=Medicion)
def validar_medicion(sender, instance, created, **kwargs):
    if not created:
        return

    tipo_sensor = instance.sensor.tipo_sensor

    # RF-37 primero: rango físico
    fuera_de_rango_fisico = not (tipo_sensor.valor_min_fisico <= instance.valor <= tipo_sensor.valor_max_fisico)

    if fuera_de_rango_fisico:
        # Dispara alerta ALTA inmediata (RNF-15) — la crea el módulo alertas,
        # acá solo se marca el estado; el módulo alertas escucha esta misma señal.
        Medicion.objects.filter(pk=instance.pk).update(estado_lectura=Medicion.EstadoLectura.FUERA_RANGO)
        return

    # RF-19: rango operativo
    rango = instance.sensor.rangos.order_by("-vigente_desde").first()
    if rango and not (rango.valor_min <= instance.valor <= rango.valor_max):
        Medicion.objects.filter(pk=instance.pk).update(estado_lectura=Medicion.EstadoLectura.FUERA_RANGO)
    else:
        Medicion.objects.filter(pk=instance.pk).update(estado_lectura=Medicion.EstadoLectura.NORMAL)