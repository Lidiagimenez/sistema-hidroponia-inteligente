from rest_framework import serializers
from apps.alertas.models import ParametroAlerta, Alerta


class ParametroAlertaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametroAlerta
        fields = "__all__"


class AlertaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alerta
        fields = "__all__"