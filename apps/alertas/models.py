from django.db import models
from django.core.exceptions import ValidationError
from apps.monitoreo.models import TipoSensor, Medicion
from apps.eventos.models import Evento


class ParametroAlerta(models.Model):
    tipo_sensor = models.OneToOneField(TipoSensor, on_delete=models.CASCADE, related_name="parametro_alerta")
    tiempo_maximo_sin_lectura = models.DurationField()
    lecturas_consecutivas_apertura = models.PositiveSmallIntegerField(default=3)
    lecturas_consecutivas_cierre = models.PositiveSmallIntegerField(default=3)
    umbral_desviacion_alta = models.FloatField()
    valor_umbral_alerta = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"Parámetros de {self.tipo_sensor}"


class Alerta(models.Model):
    class Severidad(models.TextChoices):
        BAJA = "baja", "Baja"
        MEDIA = "media", "Media"
        ALTA = "alta", "Alta"

    class Estado(models.TextChoices):
        ACTIVA = "activa", "Activa"
        RESUELTA = "resuelta", "Resuelta"

    medicion = models.ForeignKey(Medicion, on_delete=models.CASCADE, null=True, blank=True, related_name="alertas")
    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, null=True, blank=True, related_name="alertas")
    severidad = models.CharField(max_length=10, choices=Severidad.choices)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ACTIVA)
    fecha_hora_inicio = models.DateTimeField(auto_now_add=True)
    fecha_hora_fin = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(medicion__isnull=False, evento__isnull=True) |
                    models.Q(medicion__isnull=True, evento__isnull=False)
                ),
                name="alerta_origen_exclusivo",
            )
        ]

    def clean(self):
        if self.medicion_id and self.evento_id:
            raise ValidationError("Una alerta no puede tener medicion y evento a la vez.")
        if not self.medicion_id and not self.evento_id:
            raise ValidationError("Una alerta debe tener origen: medicion o evento.")

    def __str__(self):
        return f"Alerta {self.severidad} - {self.estado}"