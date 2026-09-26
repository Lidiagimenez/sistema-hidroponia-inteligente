from rest_framework import serializers
from apps.inteligencia.models import (
    ParametroImagen, AnalisisImagen, AvisoCrecimiento, Recomendacion,
)


class ParametroImagenSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametroImagen
        fields = "__all__"


class AnalisisImagenSerializer(serializers.ModelSerializer):
    cultivo_nombre = serializers.CharField(source="cultivo.nombre", read_only=True)
    etapa_display = serializers.CharField(
        source="get_etapa_fenologica_display", read_only=True
    )
    origen_display = serializers.CharField(
        source="get_origen_captura_display", read_only=True
    )
    url_imagen = serializers.SerializerMethodField()

    class Meta:
        model = AnalisisImagen
        fields = "__all__"
        read_only_fields = (
            "altura_estimada_cm", "area_foliar_cm2", "indice_verdor",
            "cobertura_pct", "delta_altura_cm", "confianza",
            "etapa_fenologica", "fecha_registro", "procesada",
            "error_analisis", "hash_sha256",
        )

    def get_url_imagen(self, obj):
        if not obj.imagen:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.imagen.url) if request else obj.imagen.url


class AvisoCrecimientoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    severidad_display = serializers.CharField(
        source="get_severidad_display", read_only=True
    )
    cultivo_nombre = serializers.CharField(source="cultivo.nombre", read_only=True)

    class Meta:
        model = AvisoCrecimiento
        fields = "__all__"
        read_only_fields = ("fecha",)


class RecomendacionSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    prioridad_display = serializers.CharField(
        source="get_prioridad_display", read_only=True
    )
class RecomendacionSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    prioridad_display = serializers.CharField(
        source="get_prioridad_display", read_only=True
    )
    cultivo_nombre = serializers.CharField(source="cultivo.nombre", read_only=True)

    class Meta:
        model = Recomendacion
        fields = "__all__"
        read_only_fields = ("fecha", "regla_origen")


class SubirImagenSerializer(serializers.Serializer):
    """Payload para POST /api/analisis-imagen/"""
    cultivo = serializers.IntegerField()
    ciclo = serializers.IntegerField(required=False, allow_null=True)
    dispositivo = serializers.IntegerField(required=False, allow_null=True)
    imagen = serializers.ImageField()
    fecha_hora = serializers.DateTimeField(required=False)
    origen_captura = serializers.ChoiceField(
        choices=["periodica", "evento", "manual", "sync_sd"],
        default="manual",
    )