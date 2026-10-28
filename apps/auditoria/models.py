from django.db import models


class RegistroAuditoria(models.Model):
    """
    Registro de acciones realizadas por usuarios del sistema (RF de auditoría).
    Sistema PARALELO a apps.eventos.Evento: acá nunca se registran eventos de
    hardware, solo actividad humana (login, logout, creaciones, ediciones,
    eliminaciones).

    usuario usa on_delete=SET_NULL para que, si un usuario se (des)activa o se
    borra, su historial de acciones no desaparezca de la auditoría.
    """

    class Accion(models.TextChoices):
        CREAR = "crear", "Crear"
        EDITAR = "editar", "Editar"
        ELIMINAR = "eliminar", "Eliminar"
        LOGIN = "login", "Inicio de sesión"
        LOGOUT = "logout", "Cierre de sesión"
        LOGIN_FALLIDO = "login_fallido", "Intento de sesión fallido"

    usuario = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acciones_auditoria",
        help_text="NULL si la acción no proviene de un usuario autenticado (ej: login fallido).",
    )
    accion = models.CharField(max_length=20, choices=Accion.choices, db_index=True)
    entidad = models.CharField(max_length=60, db_index=True, help_text='Nombre visible del módulo: "Cultivo", "Sensor", "Usuario", etc.')
    objeto_id = models.PositiveIntegerField(null=True, blank=True)
    detalles = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    fecha_hora = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-fecha_hora"]
        verbose_name = "Registro de auditoría"
        verbose_name_plural = "Registros de auditoría"

    def __str__(self):
        autor = self.usuario.username if self.usuario_id else "Anónimo"
        return f"{autor} — {self.accion} — {self.entidad} — {self.fecha_hora:%d/%m/%Y %H:%M}"