from django.contrib import admin
from apps.dispositivos.models import Dispositivo


@admin.register(Dispositivo)
class DispositivoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo_dispositivo", "estado", "cultivo")
    list_filter = ("tipo_dispositivo", "estado")