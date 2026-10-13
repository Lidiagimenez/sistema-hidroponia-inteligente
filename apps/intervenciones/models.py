from django.core.exceptions import ValidationError
from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone
from apps.alertas.models import Alerta
from apps.cultivos.models import Cultivo, CicloProduccion


class Intervencion(models.Model):
    class Tipo(models.TextChoices):
        MANTENIMIENTO = "mantenimiento", "Mantenimiento"
        AJUSTE_PARAMETROS = "ajuste_parametros", "Ajuste de parámetros"
        TRATAMIENTO = "tratamiento", "Tratamiento"
        SIEMBRA = "siembra", "Siembra"
        COSECHA = "cosecha", "Cosecha"
        OTRO = "otro", "Otro"

    class ResultadoCosecha(models.TextChoices):
        EXITOSA = "exitosa", "Exitosa"
        PARCIAL = "parcial", "Parcial"
        FALLIDA = "fallida", "Fallida"
        NO_COSECHADO = "no_cosechado", "No cosechado"

    alerta = models.ForeignKey(
        Alerta,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="intervenciones",
    )
    cultivo = models.ForeignKey(
        Cultivo,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="intervenciones",
    )
    ciclo = models.ForeignKey(
        CicloProduccion,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="intervenciones",
    )
    operador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="intervenciones",
    )
    tipo = models.CharField(max_length=30, choices=Tipo.choices, default=Tipo.MANTENIMIENTO)
    observaciones = models.TextField()
    descripcion_accion = models.TextField(blank=True)
    fecha_hora = models.DateTimeField(default=timezone.now)
    resuelta = models.BooleanField(default=False)
    fecha_cosecha_real = models.DateTimeField(null=True, blank=True)
    resultado_cosecha = models.CharField(
        max_length=20,
        choices=ResultadoCosecha.choices,
        null=True,
        blank=True,
    )
    motivo_no_cosecha = models.TextField(blank=True)
    cantidad_cosechada_kg = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(alerta__isnull=False)
                    | Q(cultivo__isnull=False)
                    | Q(ciclo__isnull=False)
                ),
                name="intervencion_tiene_origen",
            )
        ]

    def clean(self):
        if not self.alerta_id and not self.cultivo_id and not self.ciclo_id:
            raise ValidationError("La intervención debe asociarse a una alerta, cultivo o ciclo.")
        if self.tipo == self.Tipo.COSECHA:
            if self.resultado_cosecha == self.ResultadoCosecha.NO_COSECHADO and not self.motivo_no_cosecha:
                raise ValidationError("Indicá el motivo cuando la cosecha no se realiza.")
        elif any([
            self.fecha_cosecha_real,
            self.resultado_cosecha,
            self.motivo_no_cosecha,
            self.cantidad_cosechada_kg,
        ]):
            raise ValidationError("Los campos de cosecha solo aplican a intervenciones de tipo cosecha.")

    def __str__(self):
        return f"Intervención {self.id} - {self.get_tipo_display()}"
