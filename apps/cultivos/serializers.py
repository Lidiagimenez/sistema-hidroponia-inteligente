from rest_framework import serializers
from apps.cultivos.models import Cultivo, CicloProduccion


class CultivoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cultivo
        fields = "__all__"
        read_only_fields = ["usuario"]  # se asigna solo desde el request, no lo manda el cliente


class CicloProduccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CicloProduccion
        fields = "__all__"