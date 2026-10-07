from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    # Columnas que se ven en la lista de usuarios
    list_display = (
        "username",
        "email",
        "rol",
        "is_staff",
        "is_superuser",
        "is_active",
    )

    # Filtros laterales
    list_filter = (
        "rol",
        "is_staff",
        "is_superuser",
        "is_active",
    )

    # Buscador arriba
    search_fields = ("username", "email")

    # Orden por defecto
    ordering = ("username",)

    # Campos que aparecen al editar un usuario
    fieldsets = UserAdmin.fieldsets + (
        ("Información del sistema", {"fields": ("rol",)}),
    )

    # Campos que aparecen al crear un usuario nuevo
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Información del sistema", {"fields": ("rol",)}),
    )