from rest_framework import serializers
from apps.dispositivos.models import Dispositivo


class DispositivoSerializer(serializers.ModelSerializer):
    cultivo_nombre = serializers.CharField(source="cultivo.nombre", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = Dispositivo
        fields = [
            "id", "nombre", "tipo_dispositivo", "identificador_hardware", "estado",
            "estado_display", "cultivo", "cultivo_nombre", "fecha_alta",
            "ip_local", "url_captura", "permite_polling",
            "is_active", "es_simulado",
        ]
        read_only_fields = ["id", "fecha_alta"]
