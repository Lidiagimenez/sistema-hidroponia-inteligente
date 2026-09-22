from rest_framework import serializers
from apps.dispositivos.models import Dispositivo


class DispositivoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dispositivo
        fields = ["id", "nombre", "tipo_dispositivo", "identificador_hardware", "estado", "cultivo", "fecha_alta"]
        read_only_fields = ["id", "fecha_alta"]