from rest_framework import serializers
from apps.intervenciones.models import Intervencion


class IntervencionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Intervencion
        fields = "__all__"
        read_only_fields = ["operador", "fecha_hora"]

    def create(self, validated_data):
        validated_data["operador"] = self.context["request"].user
        return super().create(validated_data)