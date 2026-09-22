from django.contrib import admin
from .models import Cultivo, CicloProduccion


@admin.register(Cultivo)
class CultivoAdmin(admin.ModelAdmin):
    list_display = (
        "nombre",
        "tipo_cultivo",
        "fecha_creacion",
        "usuario",
    )
    search_fields = (
        "nombre",
        "tipo_cultivo",
    )


@admin.register(CicloProduccion)
class CicloProduccionAdmin(admin.ModelAdmin):
    list_display = (
        "cultivo",
        "fecha_inicio",
        "fecha_fin_estimada",
        "fecha_fin_real",
        "estado",
    )
    list_filter = (
        "estado",
    )