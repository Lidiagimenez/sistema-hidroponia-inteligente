from django.db import models
from apps.cultivos.models import Cultivo


class Dispositivo(models.Model):
    class TipoDispositivo(models.TextChoices):
        SENSOR = "sensor", "Sensor"
        BOMBA = "bomba", "Bomba"
        OTRO = "otro", "Otro"

    class Estado(models.TextChoices):
        ACTIVO = "activo", "Activo"
        INACTIVO = "inactivo", "Inactivo"

    nombre = models.CharField(max_length=100)
    tipo_dispositivo = models.CharField(max_length=20, choices=TipoDispositivo.choices)
    identificador_hardware = models.CharField(max_length=100, unique=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.ACTIVO)
    cultivo = models.ForeignKey(Cultivo, on_delete=models.CASCADE, related_name="dispositivos")
    fecha_alta = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nombre} ({self.tipo_dispositivo})"