from django.db import models
from apps.alertas.models import Alerta
from apps.usuarios.models import Usuario


class Intervencion(models.Model):
    alerta = models.ForeignKey(Alerta, on_delete=models.CASCADE, related_name="intervenciones")
    operador = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name="intervenciones")
    observaciones = models.TextField()
    fecha_hora = models.DateTimeField(auto_now_add=True)
    resuelta = models.BooleanField(default=False)

    def __str__(self):
        return f"Intervención {self.id} - Alerta {self.alerta_id}"