import hashlib
import secrets

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

    # --- Red / cámara (ESP32) ---
    ip_local = models.GenericIPAddressField(
        null=True, blank=True,
        help_text="IP del ESP32 en la red local. Ej: 192.168.1.50",
    )
    url_captura = models.URLField(
        blank=True,
        help_text="URL completa de captura. Si se completa, tiene prioridad sobre ip_local.",
    )
    permite_polling = models.BooleanField(
        default=False,
        help_text="Si es True, el servidor le pide fotos al dispositivo periódicamente.",
    )

    # --- Autenticación del dispositivo (API key) ---
    # Nunca se guarda la clave en claro: solo su hash SHA-256.
    api_key_hash = models.CharField(max_length=64, blank=True, db_index=True, editable=False)

    def __str__(self):
        return f"{self.nombre} ({self.tipo_dispositivo})"

    @property
    def esta_activo(self):
        return self.estado == self.Estado.ACTIVO

    @staticmethod
    def hashear_api_key(clave):
        return hashlib.sha256(clave.encode()).hexdigest()

    def generar_api_key(self):
        """Genera una clave nueva, guarda su hash y devuelve la clave en claro (una sola vez)."""
        clave = secrets.token_urlsafe(32)
        self.api_key_hash = self.hashear_api_key(clave)
        self.save(update_fields=["api_key_hash"])
        return clave
