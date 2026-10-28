from rest_framework import serializers
from apps.common.validators import validate_uploaded_image
from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion, Imagen


class TipoSensorSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoSensor
        fields = "__all__"


class SensorSerializer(serializers.ModelSerializer):
    tipo_sensor_nombre = serializers.CharField(source="tipo_sensor.nombre", read_only=True)
    unidad_medida = serializers.CharField(source="tipo_sensor.unidad_medida", read_only=True)
    dispositivo_nombre = serializers.CharField(source="dispositivo.nombre", read_only=True)
    cultivos_detalle = serializers.SerializerMethodField()
    cultivo_principal = serializers.SerializerMethodField()

    class Meta:
        model = Sensor
        fields = [
            "id",
            "dispositivo",
            "dispositivo_nombre",
            "tipo_sensor",
            "tipo_sensor_nombre",
            "unidad_medida",
            "cultivos",
            "cultivos_detalle",
            "cultivo_principal",
            "is_active",
        ]

    def get_cultivos_detalle(self, obj):
        return [
            {"id_cultivo": cultivo.pk, "nombre": cultivo.nombre}
            for cultivo in obj.cultivos.all()
        ]

    def get_cultivo_principal(self, obj):
        cultivo = obj.cultivos.first()
        if cultivo is None:
            # Compatibilidad: sensores viejos sin M2M heredan el cultivo del dispositivo.
            cultivo = obj.dispositivo.cultivo if obj.dispositivo_id else None
        if cultivo is None:
            return None
        return {"id_cultivo": cultivo.pk, "nombre": cultivo.nombre}


class RangoOperacionSerializer(serializers.ModelSerializer):
    sensor_nombre = serializers.SerializerMethodField()
    unidad_medida = serializers.CharField(source="sensor.tipo_sensor.unidad_medida", read_only=True)

    class Meta:
        model = RangoOperacion
        fields = "__all__"

    def get_sensor_nombre(self, obj):
        return str(obj.sensor)


class MedicionSerializer(serializers.ModelSerializer):
    tipo_sensor = serializers.IntegerField(source="sensor.tipo_sensor_id", read_only=True)
    tipo_sensor_nombre = serializers.CharField(source="sensor.tipo_sensor.nombre", read_only=True)
    unidad_medida = serializers.CharField(source="sensor.tipo_sensor.unidad_medida", read_only=True)
    sensor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Medicion
        fields = "__all__"
        read_only_fields = ["fecha_hora", "estado_lectura"]

    def get_sensor_nombre(self, obj):
        return obj.sensor.tipo_sensor.nombre


class ImagenSerializer(serializers.ModelSerializer):
    cultivo_nombre = serializers.CharField(source="cultivo.nombre", read_only=True)
    archivo_url = serializers.SerializerMethodField()

    class Meta:
        model = Imagen
        fields = [
            "id",
            "cultivo",
            "cultivo_nombre",
            "fecha_hora",  # sigue escribible: store & forward del ESP32
            "archivo",
            "archivo_url",
        ]

    def validate_archivo(self, value):
        return validate_uploaded_image(value)

    def get_archivo_url(self, obj):
        if not obj.archivo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.archivo.url) if request else obj.archivo.url
