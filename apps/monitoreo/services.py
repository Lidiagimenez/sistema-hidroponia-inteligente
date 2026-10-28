from apps.monitoreo.models import Sensor, Medicion
from django.utils import timezone

def registrar_medicion(sensor_id, valor, fecha_hora=None):
    sensor = Sensor.objects.get(id=sensor_id)
    
    # Si el ESP32 nos envía una fecha (porque estaba guardada en la SD), la usamos.
    # Si no nos envían nada (None), usamos la fecha y hora actual.
    if fecha_hora is None:
        fecha_hora = timezone.now()
        
    return Medicion.objects.create(
        sensor=sensor, 
        valor=valor,
        fecha_hora=fecha_hora
    )