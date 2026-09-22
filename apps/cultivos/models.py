from django.conf import settings
from django.db import models


class Cultivo(models.Model):
    id_cultivo = models.BigAutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    tipo_cultivo = models.CharField(
    max_length=100,
    default="No especificado",
)
    fecha_creacion = models.DateField()

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cultivos",
    )

    def __str__(self):
        return self.nombre


class CicloProduccion(models.Model):
    
    id_ciclo = models.BigAutoField(primary_key=True)

    cultivo = models.ForeignKey(
        Cultivo,
        on_delete=models.CASCADE,
        related_name="ciclos",
    )

    fecha_inicio = models.DateField()
    fecha_fin_estimada = models.DateField(
        null=True,
        blank=True,
    )
    fecha_fin_real = models.DateField(
        null=True,
        blank=True,
    )
    estado = models.CharField(
    max_length=30,
    default="germinacion",
)

    def __str__(self):
        return f"Ciclo de {self.cultivo.nombre}"