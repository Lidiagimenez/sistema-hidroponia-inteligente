from django.db import models


# =============================================================================
# Parámetros de captura
# =============================================================================

class ParametroImagen(models.Model):
    """Configuración de captura y análisis de imágenes por cultivo."""

    cultivo = models.OneToOneField(
        "cultivos.Cultivo",
        on_delete=models.CASCADE,
        related_name="parametro_imagen",
    )

    # --- Captura ---
    frecuencia_captura_minutos = models.PositiveIntegerField(
        default=30,
        help_text="Intervalo entre capturas periódicas, en minutos."
    )
    hora_inicio_captura = models.PositiveSmallIntegerField(
        default=8,
        help_text="Hora (0-23) a partir de la cual se capturan imágenes."
    )
    hora_fin_captura = models.PositiveSmallIntegerField(
        default=19,
        help_text="Hora (0-23) hasta la cual se capturan imágenes."
    )
    capturar_por_evento = models.BooleanField(
        default=True,
        help_text="Capturar una imagen adicional cuando ocurre una alerta o evento."
    )
    retencion_dias = models.PositiveIntegerField(
        default=7,
        help_text="Días de historial de imágenes a conservar en el backend."
    )

    # --- Análisis (placeholder, ver services.py) ---
    distancia_camara_cm = models.FloatField(default=30.0)
    marcador_referencia_cm = models.FloatField(
        null=True, blank=True,
        help_text="Tamaño real del objeto de referencia (regla, sticker, ArUco)."
    )
    pixeles_por_cm = models.FloatField(
        null=True, blank=True,
        help_text="Factor de conversión píxel→cm."
    )

    # --- Umbrales de aviso (blandos) ---
    dias_sin_crecimiento_para_aviso = models.PositiveIntegerField(default=3)
    desvio_maximo_curva_pct = models.FloatField(default=25.0)
    caida_verdor_pct_para_aviso = models.FloatField(default=20.0)

    # --- Curva esperada: {"etapa": [[dia, altura_cm], ...]} ---
    curva_esperada = models.JSONField(
        default=dict, blank=True,
        help_text="Ej: {'crecimiento': [[13, 6], [35, 25]]}."
    )

    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Parámetro de imagen"
        verbose_name_plural = "Parámetros de imagen"

    def __str__(self):
        return f"ParametroImagen({self.cultivo.nombre})"


# =============================================================================
# Análisis de imagen
# =============================================================================

class AnalisisImagen(models.Model):
    """
    Registro de una imagen capturada y (a futuro) su análisis.
    Hoy las métricas quedan en None — se llenan cuando se retome imagen.
    """

    class EtapaFenologica(models.TextChoices):
        GERMINACION = "germinacion", "Germinación"
        PLANTULA = "plantula", "Plántula"
        CRECIMIENTO = "crecimiento", "Crecimiento vegetativo"
        FLORACION = "floracion", "Floración"
        COSECHA = "cosecha", "Cosecha"

    class OrigenCaptura(models.TextChoices):
        PERIODICA = "periodica", "Periódica"
        EVENTO = "evento", "Por evento"
        MANUAL = "manual", "Manual"
        SYNC_SD = "sync_sd", "Sincronizada desde SD"

    cultivo = models.ForeignKey(
        "cultivos.Cultivo", on_delete=models.CASCADE, related_name="analisis_imagen"
    )
    ciclo = models.ForeignKey(
        "cultivos.CicloProduccion", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="analisis_imagen"
    )
    dispositivo = models.ForeignKey(
        "dispositivos.Dispositivo", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="analisis_imagen",
        help_text="Cámara que tomó la foto."
    )

    imagen = models.ImageField(upload_to="analisis/%Y/%m/%d/")
    fecha_hora = models.DateTimeField(
        help_text="Momento real de la captura en el dispositivo."
    )
    origen_captura = models.CharField(
        max_length=20, choices=OrigenCaptura.choices, default=OrigenCaptura.PERIODICA
    )
    hash_sha256 = models.CharField(
        max_length=64, blank=True, db_index=True,
        help_text="Para evitar duplicados al sincronizar desde SD."
    )

    # --- Métricas (se llenan al analizar; hoy quedan None) ---
    altura_estimada_cm = models.FloatField(null=True, blank=True)
    area_foliar_cm2 = models.FloatField(null=True, blank=True)
    indice_verdor = models.FloatField(null=True, blank=True)
    cobertura_pct = models.FloatField(null=True, blank=True)
    delta_altura_cm = models.FloatField(null=True, blank=True)
    confianza = models.FloatField(default=0.0, help_text="0.0 a 1.0")

    etapa_fenologica = models.CharField(
        max_length=20, choices=EtapaFenologica.choices,
        default=EtapaFenologica.GERMINACION,
    )
    observaciones = models.TextField(blank=True)
    procesada = models.BooleanField(
        default=False, db_index=True,
        help_text="True cuando el análisis automático ya corrió sobre esta imagen."
    )
    error_analisis = models.TextField(blank=True)

    fecha_registro = models.DateTimeField(
        auto_now_add=True,
        help_text="Cuándo llegó la imagen al backend (puede diferir de la captura)."
    )

    class Meta:
        ordering = ["-fecha_hora"]
        verbose_name = "Análisis de imagen"
        verbose_name_plural = "Análisis de imágenes"
        indexes = [
            models.Index(fields=["cultivo", "-fecha_hora"]),
            models.Index(fields=["dispositivo", "-fecha_hora"]),
        ]

    def __str__(self):
        return f"AnalisisImagen({self.cultivo.nombre}, {self.fecha_hora:%Y-%m-%d %H:%M})"


# =============================================================================
# Avisos de crecimiento (blandos, NO son alertas)
# =============================================================================

class AvisoCrecimiento(models.Model):
    """
    Aviso blando de crecimiento. NO es una Alerta.
    Aparece en el panel 'Crecimiento del cultivo', no en alertas activas.
    """

    class Tipo(models.TextChoices):
        SIN_CRECIMIENTO = "sin_crecimiento", "Sin crecimiento"
        CRECIMIENTO_NEGATIVO = "crecimiento_negativo", "Crecimiento negativo"
        DESVIO_CURVA = "desvio_curva", "Desvío respecto a la curva esperada"
        CAIDA_VERDOR = "caida_verdor", "Caída del índice de verdor"

    class Severidad(models.TextChoices):
        INFO = "info", "Información"
        ADVERTENCIA = "advertencia", "Advertencia"

    cultivo = models.ForeignKey(
        "cultivos.Cultivo", on_delete=models.CASCADE, related_name="avisos_crecimiento"
    )
    tipo = models.CharField(max_length=30, choices=Tipo.choices)
    severidad = models.CharField(
        max_length=15, choices=Severidad.choices, default=Severidad.INFO
    )
    analisis_origen = models.ForeignKey(
        AnalisisImagen, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="avisos",
        help_text="SET_NULL para que borrar imágenes viejas no borre avisos."
    )
    descripcion = models.TextField()
    resuelto = models.BooleanField(default=False, db_index=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "Aviso de crecimiento"
        verbose_name_plural = "Avisos de crecimiento"

    def __str__(self):
        return f"Aviso({self.get_tipo_display()} - {self.cultivo.nombre})"


# =============================================================================
# Recomendaciones (motor de reglas, NO IA entrenada)
# =============================================================================

class Recomendacion(models.Model):
    """
    Recomendación generada por el motor de reglas.
    No es una alerta. Es una sugerencia que aparece en el panel del cultivo.
    """

    class Tipo(models.TextChoices):
        RIEGO = "riego", "Riego"
        NUTRICION = "nutricion", "Nutrición"
        PH = "ph", "Ajuste de pH"
        CONDUCTIVIDAD = "conductividad", "Ajuste de conductividad"
        TEMPERATURA = "temperatura", "Temperatura"
        ILUMINACION = "iluminacion", "Iluminación"
        CRECIMIENTO = "crecimiento", "Crecimiento"
        COSECHA = "cosecha", "Cosecha"
        OTRO = "otro", "Otro"

    class Prioridad(models.TextChoices):
        BAJA = "baja", "Baja"
        MEDIA = "media", "Media"
        ALTA = "alta", "Alta"

    cultivo = models.ForeignKey(
        "cultivos.Cultivo", on_delete=models.CASCADE, related_name="recomendaciones"
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    prioridad = models.CharField(
        max_length=10, choices=Prioridad.choices, default=Prioridad.MEDIA
    )
    titulo = models.CharField(max_length=200)
    detalle = models.TextField(blank=True)
    regla_origen = models.CharField(
        max_length=100,
        help_text="Identificador de la regla que la generó. Ej: 'ph_bajo_sostenido'."
    )
    vigente = models.BooleanField(default=True, db_index=True)
    resuelta = models.BooleanField(default=False, db_index=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "Recomendación"
        verbose_name_plural = "Recomendaciones"
        indexes = [
            models.Index(fields=["cultivo", "-fecha"]),
            models.Index(fields=["vigente", "resuelta"]),
        ]

    def __str__(self):
        return f"Recomendacion({self.get_tipo_display()} - {self.cultivo.nombre})"