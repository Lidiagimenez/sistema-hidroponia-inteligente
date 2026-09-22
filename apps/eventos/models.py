from django.db import models
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo, CicloProduccion


class Evento(models.Model):
    class TipoEvento(models.TextChoices):
        SENSOR_SIN_COMUNICACION = "sensor_sin_comunicacion", "Sensor sin comunicación"
        CORTE_ELECTRICO = "corte_electrico", "Corte de energía"
        BOMBA_SIN_CAUDAL = "bomba_sin_caudal", "Bomba sin caudal"

    tipo_evento = models.CharField(max_length=30, choices=TipoEvento.choices)
    fecha_hora = models.DateTimeField(auto_now_add=True)
    descripcion = models.TextField(blank=True)
    dispositivo = models.ForeignKey(
        Dispositivo, on_delete=models.SET_NULL, null=True, blank=True, related_name="eventos"
    )
    cultivo = models.ForeignKey(Cultivo, on_delete=models.CASCADE, related_name="eventos")
    ciclo = models.ForeignKey(
        CicloProduccion, on_delete=models.SET_NULL, null=True, blank=True, related_name="eventos"
    )

    def __str__(self):
        return f"{self.tipo_evento} - {self.cultivo} - {self.fecha_hora}"