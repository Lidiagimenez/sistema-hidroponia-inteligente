from rest_framework import serializers

from apps.auditoria.models import RegistroAuditoria


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    usuario_username = serializers.SerializerMethodField()
    usuario_rol = serializers.SerializerMethodField()

    # Label legible del choices (ej: "login" → "Inicio de sesión").
    # El frontend lo usa directamente para mostrar texto, sin mapeo manual.
    accion_display = serializers.CharField(source="get_accion_display", read_only=True)

    class Meta:
        model = RegistroAuditoria
        fields = [
            "id",
            "fecha_hora",
            "accion",
            "accion_display",
            "entidad",
            "objeto_id",
            "detalles",
            "ip_address",
            "usuario",
            "usuario_username",
            "usuario_rol",
        ]

    def get_usuario_username(self, obj):
        # SET_NULL: el usuario pudo haber sido desactivado/borrado; el historial
        # sobrevive pero la FK puede ser NULL.
        return obj.usuario.username if obj.usuario_id and obj.usuario else None

    def get_usuario_rol(self, obj):
        return obj.usuario.rol if obj.usuario_id and obj.usuario else None