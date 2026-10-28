from django.contrib import admin, messages
from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion, Imagen
from apps.inteligencia import ia


@admin.register(TipoSensor)
class TipoSensorAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre", "unidad_medida", "valor_min_fisico", "valor_max_fisico")
    search_fields = ("nombre",)
    actions = ["entrenar_modelos"]

    @admin.action(description="Entrenar modelos IA (Isolation Forest) para los seleccionados")
    def entrenar_modelos(self, request, queryset):
        ok = sin_datos = errores = 0
        for tipo in queryset:
            try:
                modelo = ia.entrenar_modelo(tipo.id)
                if modelo:
                    ok += 1
                else:
                    sin_datos += 1
            except Exception as e:
                errores += 1
                self.message_user(request, f"Error con {tipo.nombre}: {e}", level=messages.ERROR)
        self.message_user(
            request,
            f"Entrenamiento completado. OK: {ok}, sin datos suficientes: {sin_datos}, errores: {errores}",
            level=messages.SUCCESS if errores == 0 else messages.WARNING,
        )


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = ("id", "dispositivo", "tipo_sensor", "is_active")
    list_filter = ("is_active", "tipo_sensor")
    search_fields = ("dispositivo__nombre",)
    filter_horizontal = ("cultivos",)


@admin.register(RangoOperacion)
class RangoOperacionAdmin(admin.ModelAdmin):
    list_display = ("id", "sensor", "valor_min", "valor_max", "vigente_desde")
    search_fields = ("sensor__dispositivo__nombre",)


@admin.register(Medicion)
class MedicionAdmin(admin.ModelAdmin):
    list_display = ("id", "sensor", "valor", "fecha_hora", "estado_lectura")
    list_filter = ("estado_lectura", "sensor__tipo_sensor")
    readonly_fields = ("fecha_hora",)


@admin.register(Imagen)
class ImagenAdmin(admin.ModelAdmin):
    list_display = ("id", "cultivo", "fecha_hora", "archivo")
    list_filter = ("cultivo",)
    readonly_fields = ("fecha_hora",)
