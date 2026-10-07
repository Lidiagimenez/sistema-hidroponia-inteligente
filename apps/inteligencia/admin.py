from django.contrib import admin

from apps.inteligencia.models import (
    ParametroImagen,
    AnalisisImagen,
    AvisoCrecimiento,
    Recomendacion,
    Anomalia,
)


@admin.register(ParametroImagen)
class ParametroImagenAdmin(admin.ModelAdmin):
    list_display = (
        "cultivo", "frecuencia_captura_minutos",
        "hora_inicio_captura", "hora_fin_captura",
        "retencion_dias",
    )
    search_fields = ("cultivo__nombre",)


@admin.register(AnalisisImagen)
class AnalisisImagenAdmin(admin.ModelAdmin):
    list_display = (
        "cultivo", "fecha_hora", "origen_captura",
        "altura_estimada_cm", "procesada",
    )
    list_filter = ("procesada", "etapa_fenologica", "origen_captura")
    search_fields = ("cultivo__nombre",)
    readonly_fields = ("hash_sha256", "fecha_registro")


@admin.register(AvisoCrecimiento)
class AvisoCrecimientoAdmin(admin.ModelAdmin):
    list_display = ("cultivo", "tipo", "severidad", "fecha", "resuelto")
    list_filter = ("tipo", "severidad", "resuelto")


@admin.register(Recomendacion)
class RecomendacionAdmin(admin.ModelAdmin):
    list_display = (
        "cultivo", "tipo", "prioridad", "titulo",
        "vigente", "resuelta", "fecha",
    )
    list_filter = ("tipo", "prioridad", "vigente", "resuelta")
    search_fields = ("cultivo__nombre", "titulo", "regla_origen")


@admin.register(Anomalia)
class AnomaliaAdmin(admin.ModelAdmin):
    list_display = (
        "id", "cultivo", "sensor", "score", "origen",
        "estado", "fecha_deteccion",
    )
    list_filter = ("estado", "origen", "modelo_version", "fecha_deteccion")
    search_fields = ("cultivo__nombre", "sensor__tipo_sensor__nombre", "descripcion")
    readonly_fields = (
        "cultivo", "sensor", "medicion", "origen", "score",
        "valor_observado", "valor_esperado_min", "valor_esperado_max",
        "descripcion", "modelo_version", "fecha_deteccion",
    )
    date_hierarchy = "fecha_deteccion"

    fieldsets = (
        ("Contexto", {
            "fields": ("cultivo", "sensor", "medicion", "origen")
        }),
        ("Detección", {
            "fields": ("score", "valor_observado",
                       "valor_esperado_min", "valor_esperado_max")
        }),
        ("Descripción", {
            "fields": ("descripcion", "modelo_version")
        }),
        ("Estado", {
            "fields": ("estado", "fecha_deteccion")
        }),
    )