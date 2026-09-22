from rest_framework import serializers
from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion, Imagen


class TipoSensorSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoSensor
        fields = "__all__"


class SensorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sensor
        fields = "__all__"


class RangoOperacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RangoOperacion
        fields = "__all__"


class MedicionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicion
        fields = "__all__"
        read_only_fields = ["fecha_hora", "estado_lectura"]


class ImagenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Imagen
        fields = "__all__"
        read_only_fields = ["fecha_hora"]