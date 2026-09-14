from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.monitoreo.models import Medicion
from apps.eventos.models import Evento
from apps.alertas.models import Alerta
from apps.alertas.services import verificar_lecturas_consecutivas_y_generar_alerta, verificar_cierre_por_lecturas_normales

SEVERIDAD_POR_EVENTO = {
    Evento.TipoEvento.SENSOR_SIN_COMUNICACION: Alerta.Severidad.MEDIA,
    Evento.TipoEvento.CORTE_ELECTRICO: Alerta.Severidad.ALTA,
    Evento.TipoEvento.BOMBA_SIN_CAUDAL: Alerta.Severidad.ALTA,
}


@receiver(post_save, sender=Medicion)
def evaluar_alerta_por_medicion(sender, instance, created, **kwargs):
    if not created:
        return

    instance.refresh_from_db()

    tipo_sensor = instance.sensor.tipo_sensor
    fisicamente_invalida = not (tipo_sensor.valor_min_fisico <= instance.valor <= tipo_sensor.valor_max_fisico)

    if fisicamente_invalida:
        # RNF-15: alerta ALTA inmediata, sin esperar N lecturas
        Alerta.objects.create(medicion=instance, severidad=Alerta.Severidad.ALTA)
        return

    if instance.estado_lectura == Medicion.EstadoLectura.FUERA_RANGO:
        verificar_lecturas_consecutivas_y_generar_alerta(instance.sensor)
    else:
        verificar_cierre_por_lecturas_normales(instance.sensor)


@receiver(post_save, sender=Evento)
def crear_alerta_por_evento(sender, instance, created, **kwargs):
    if not created:
        return
    severidad = SEVERIDAD_POR_EVENTO.get(instance.tipo_evento)
    if severidad:
        Alerta.objects.create(evento=instance, severidad=severidad)