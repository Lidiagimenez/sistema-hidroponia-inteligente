from django.db import models
from django.utils import timezone
from apps.dispositivos.models import Dispositivo
from apps.cultivos.models import Cultivo


class TipoSensor(models.Model):
    nombre = models.CharField(max_length=100)
    unidad_medida = models.CharField(max_length=20)
    valor_min_fisico = models.FloatField()
    valor_max_fisico = models.FloatField()

    def __str__(self):
        return self.nombre


class Sensor(models.Model):
    dispositivo = models.ForeignKey(Dispositivo, on_delete=models.CASCADE, related_name="sensores")
    tipo_sensor = models.ForeignKey(TipoSensor, on_delete=models.PROTECT, related_name="sensores")
    cultivos = models.ManyToManyField(
        Cultivo,
        related_name="sensores",
        blank=True,
        help_text="Un sensor puede estar asociado a uno o varios cultivos.",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="False = borrado lógico. El sensor deja de aceptar lecturas.",
    )

    def __str__(self):
        return f"{self.tipo_sensor} en {self.dispositivo}"


class RangoOperacion(models.Model):
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, related_name="rangos")
    valor_min = models.FloatField()
    valor_max = models.FloatField()
    vigente_desde = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.valor_min}-{self.valor_max} ({self.sensor})"


class Medicion(models.Model):
    class EstadoLectura(models.TextChoices):
        NORMAL = "normal", "Normal"
        FUERA_RANGO = "fuera_rango", "Fuera de rango"

    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, related_name="mediciones")
    valor = models.FloatField()
    # 👇 CAMBIO AQUÍ: Se cambió auto_now_add por default=timezone.now
    fecha_hora = models.DateTimeField(default=timezone.now) 
    estado_lectura = models.CharField(max_length=20, choices=EstadoLectura.choices, default=EstadoLectura.NORMAL)

    def __str__(self):
        return f"{self.valor} - {self.sensor} - {self.fecha_hora}"


class Imagen(models.Model):
    cultivo = models.ForeignKey(Cultivo, on_delete=models.CASCADE, related_name="imagenes")
    # 👇 CAMBIO AQUÍ: También lo cambiamos por si mandas fotos desde la SD
    fecha_hora = models.DateTimeField(default=timezone.now) 
    archivo = models.ImageField(upload_to="imagenes_cultivo/")

    def __str__(self):
        return f"Imagen {self.cultivo} - {self.fecha_hora}"