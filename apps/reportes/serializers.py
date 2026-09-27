from rest_framework import serializers
from apps.reportes.models import Reporte


class ReporteSerializer(serializers.ModelSerializer):
    # Campos extra que no están en el modelo pero el frontend necesita
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    formato_display = serializers.CharField(source="get_formato_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    cultivo_nombre = serializers.CharField(source="cultivo.nombre", read_only=True, default=None)
    url_descarga = serializers.SerializerMethodField()

    class Meta:
        model = Reporte
        fields = "__all__"
        # El usuario no puede setear estos campos a mano: los maneja el backend
        read_only_fields = (
            "archivo", "estado", "error_detalle", "total_registros",
            "generado_por", "fecha_solicitud", "fecha_generacion",
        )

    def get_url_descarga(self, obj):
        # Si no hay archivo generado todavía, no hay URL
        if not obj.archivo:
            return None
        req = self.context.get("request")
        # build_absolute_uri convierte "/media/..." en "http://localhost:8000/media/..."
        return req.build_absolute_uri(obj.archivo.url) if req else obj.archivo.url