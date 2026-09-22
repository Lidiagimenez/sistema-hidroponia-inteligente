from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuario(AbstractUser):

    class Rol(models.TextChoices):
        ADMINISTRADOR = "administrador", "Administrador"
        OPERADOR = "operador", "Operador"

    rol = models.CharField(
        max_length=20,
        choices=Rol.choices,
        default=Rol.OPERADOR,
    )