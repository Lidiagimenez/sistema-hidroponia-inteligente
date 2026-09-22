from apps.monitoreo.models import Sensor, Medicion


def registrar_medicion(sensor_id, valor):
    sensor = Sensor.objects.get(id=sensor_id)
    return Medicion.objects.create(sensor=sensor, valor=valor)