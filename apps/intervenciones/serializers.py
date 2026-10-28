from rest_framework import serializers
from apps.intervenciones.models import Intervencion


class IntervencionSerializer(serializers.ModelSerializer):
    cultivo_nombre = serializers.CharField(source="cultivo.nombre", read_only=True, default=None)
    ciclo_nombre = serializers.SerializerMethodField()
    alerta_descripcion = serializers.SerializerMethodField()
    
    # NUEVO CAMPO PARA SENSOR
    sensor_nombre = serializers.SerializerMethodField()
    
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    resultado_display = serializers.CharField(source="get_resultado_cosecha_display", read_only=True, default=None)
    operador_username = serializers.CharField(source="operador.username", read_only=True)

    class Meta:
        model = Intervencion
        fields = [
            "id",
            "alerta",
            "cultivo",
            "ciclo",
            "sensor",         # <--- NUEVO
            "sensor_nombre",  # <--- NUEVO
            "operador",
            "operador_username",
            "tipo",
            "tipo_display",
            "observaciones",
            "descripcion_accion",
            "fecha_hora",
            "resuelta",
            "fecha_cosecha_real",
            "resultado_cosecha",
            "resultado_display",
            "motivo_no_cosecha",
            "cantidad_cosechada_kg",
            "cultivo_nombre",
            "ciclo_nombre",
            "alerta_descripcion",
        ]
        read_only_fields = ["operador"]

    def get_ciclo_nombre(self, obj):
        if not obj.ciclo:
            return None
        return f"Ciclo #{obj.ciclo_id} - {obj.ciclo.cultivo.nombre}"

    def get_alerta_descripcion(self, obj):
        if not obj.alerta:
            return None
        if obj.alerta.medicion_id:
            return f"Alerta por medición #{obj.alerta.medicion_id}"
        return f"Alerta por evento #{obj.alerta.evento_id}"
        
    # <--- NUEVO MÉTODO PARA EL NOMBRE DEL SENSOR
    def get_sensor_nombre(self, obj):
        if not obj.sensor:
            return None
        tipo = obj.sensor.tipo_sensor.nombre if obj.sensor.tipo_sensor else "Sensor"
        return f"{tipo} (ID: {obj.sensor.id})"

    def validate(self, attrs):
        instance = self.instance
        alerta = attrs.get("alerta", getattr(instance, "alerta", None))
        cultivo = attrs.get("cultivo", getattr(instance, "cultivo", None))
        ciclo = attrs.get("ciclo", getattr(instance, "ciclo", None))
        sensor = attrs.get("sensor", getattr(instance, "sensor", None)) # <--- NUEVO
        tipo = attrs.get("tipo", getattr(instance, "tipo", Intervencion.Tipo.MANTENIMIENTO))
        resultado = attrs.get("resultado_cosecha", getattr(instance, "resultado_cosecha", None))
        motivo = attrs.get("motivo_no_cosecha", getattr(instance, "motivo_no_cosecha", ""))

        # <--- ACTUALIZADO CON SENSOR
        if not alerta and not cultivo and not ciclo and not sensor:
            raise serializers.ValidationError("La intervención debe asociarse a una alerta, cultivo, ciclo o sensor.")

        user = self.context["request"].user
        if not getattr(user, "is_superuser", False) and getattr(user, "rol", None) == "operador":
            tipos_operador = {
                Intervencion.Tipo.MANTENIMIENTO,
                Intervencion.Tipo.AJUSTE_PARAMETROS,
                Intervencion.Tipo.TRATAMIENTO,
                Intervencion.Tipo.COSECHA,
            }
            if tipo not in tipos_operador:
                raise serializers.ValidationError({"tipo": "El operador no puede registrar este tipo de intervención."})

        if tipo == Intervencion.Tipo.COSECHA:
            if resultado == Intervencion.ResultadoCosecha.NO_COSECHADO and not motivo:
                raise serializers.ValidationError({"motivo_no_cosecha": "Indicá por qué no se realizó la cosecha."})
        else:
            campos_cosecha = [
                "fecha_cosecha_real",
                "resultado_cosecha",
                "motivo_no_cosecha",
                "cantidad_cosechada_kg",
            ]
            if any(
                (attrs[campo] if campo in attrs else getattr(instance, campo, None))
                not in (None, "")
                for campo in campos_cosecha
            ):
                raise serializers.ValidationError("Los campos de cosecha solo aplican al tipo cosecha.")

        return attrs

    def create(self, validated_data):
        validated_data["operador"] = self.context["request"].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        user = self.context["request"].user
        if getattr(user, "rol", None) == "administrador" or getattr(user, "is_superuser", False):
            validated_data.pop("observaciones", None)
        return super().update(instance, validated_data)