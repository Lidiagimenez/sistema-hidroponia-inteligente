from rest_framework import serializers

from apps.alertas.models import ParametroAlerta, Alerta


# =============================================================================
# HELPERS — Generan texto útil a partir de la alerta
# =============================================================================

def _obtener_rango_vigente(sensor):
    """Devuelve el RangoOperacion vigente del sensor o None."""
    if not sensor:
        return None
    return sensor.rangos.order_by("-vigente_desde").first()


def _calcular_desvio_pct(valor, valor_min, valor_max):
    """
    Devuelve el % de desvío respecto al límite más cercano.
    Positivo si está por encima del máximo, negativo si está por debajo del mínimo.
    """
    if valor_min is None or valor_max is None:
        return None
    if valor > valor_max:
        if valor_max == 0:
            return 100.0
        return round(((valor - valor_max) / abs(valor_max)) * 100, 2)
    if valor < valor_min:
        if valor_min == 0:
            return -100.0
        return round(((valor - valor_min) / abs(valor_min)) * 100, 2)
    return 0.0


def _titulo_descriptivo_medicion(medicion):
    """Genera un título legible para una alerta por medición."""
    sensor = medicion.sensor
    tipo = sensor.tipo_sensor
    nombre = tipo.nombre
    valor = medicion.valor
    unidad = tipo.unidad_medida or ""
    rango = _obtener_rango_vigente(sensor)

    if rango:
        if valor > rango.valor_max:
            return f"{nombre} {valor} {unidad} por encima del rango"
        if valor < rango.valor_min:
            return f"{nombre} {valor} {unidad} por debajo del rango"
    return f"{nombre} {valor} {unidad} fuera de rango"


def _titulo_descriptivo_evento(evento):
    """Genera un título legible para una alerta por evento."""
    return evento.get_tipo_evento_display()


def _acciones_sugeridas_medicion(medicion):
    """Devuelve una lista de acciones sugeridas según el tipo de sensor."""
    sensor = medicion.sensor
    tipo = sensor.tipo_sensor
    nombre = tipo.nombre.lower()
    valor = medicion.valor
    rango = _obtener_rango_vigente(sensor)

    acciones = [f"Medir {nombre} con un instrumento manual para confirmar el valor."]

    if rango:
        if valor > rango.valor_max:
            if "ph" in nombre:
                acciones.append("Agregar solución ácida para bajar el pH.")
            elif "conductividad" in nombre or "ec" in nombre:
                acciones.append("Diluir la solución nutritiva con agua.")
            elif "temperatura" in nombre:
                acciones.append("Ventilar el cultivo o bajar la temperatura ambiente.")
            elif "humedad" in nombre:
                acciones.append("Reducir la humedad con ventilación.")
        elif valor < rango.valor_min:
            if "ph" in nombre:
                acciones.append("Agregar solución alcalina para subir el pH.")
            elif "conductividad" in nombre or "ec" in nombre:
                acciones.append("Reforzar la solución nutritiva.")
            elif "temperatura" in nombre:
                acciones.append("Verificar calefacción o aislación del cultivo.")
            elif "humedad" in nombre:
                acciones.append("Aumentar la humedad con riego o humidificador.")

    acciones.append("Esperar 15 minutos y volver a medir.")
    acciones.append("Si el problema persiste, contactar al administrador.")
    return acciones


def _acciones_sugeridas_evento(evento):
    """Devuelve acciones sugeridas según el tipo de evento."""
    tipo = evento.tipo_evento

    if tipo == "sensor_sin_comunicacion":
        return [
            "Verificar que el dispositivo esté encendido.",
            "Revisar la conexión de red (cable o WiFi).",
            "Reiniciar el dispositivo si es necesario.",
            "Si persiste, contactar al administrador.",
        ]
    if tipo == "corte_electrico":
        return [
            "Verificar la fuente de alimentación principal.",
            "Revisar el disyuntor o térmica.",
            "Confirmar que la bomba y los sensores vuelvan a encender.",
            "Si el corte es prolongado, contactar al administrador.",
        ]
    if tipo == "bomba_sin_caudal":
        return [
            "Verificar que la bomba esté encendida.",
            "Revisar obstrucciones en la tubería.",
            "Confirmar el nivel de agua en el tanque.",
            "Si persiste, contactar al administrador.",
        ]
    return [
        "Revisar el estado del sistema.",
        "Consultar con el administrador si es necesario.",
    ]


# =============================================================================
# SERIALIZERS
# =============================================================================

class ParametroAlertaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParametroAlerta
        fields = "__all__"


class AlertaSerializer(serializers.ModelSerializer):
    # Campos básicos del modelo
    severidad_display = serializers.CharField(source="get_severidad_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    # Campos calculados
    titulo_descriptivo = serializers.SerializerMethodField()
    origen_tipo = serializers.SerializerMethodField()
    cultivo_nombre = serializers.SerializerMethodField()

    medicion_detalle = serializers.SerializerMethodField()
    evento_detalle = serializers.SerializerMethodField()
    acciones_sugeridas = serializers.SerializerMethodField()

    class Meta:
        model = Alerta
        fields = (
            "id",
            "medicion",
            "evento",
            "severidad",
            "severidad_display",
            "estado",
            "estado_display",
            "fecha_hora_inicio",
            "fecha_hora_fin",
            # Campos calculados
            "titulo_descriptivo",
            "origen_tipo",
            "cultivo_nombre",
            "medicion_detalle",
            "evento_detalle",
            "acciones_sugeridas",
        )

    def get_titulo_descriptivo(self, obj):
        if obj.medicion_id:
            return _titulo_descriptivo_medicion(obj.medicion)
        if obj.evento_id:
            return _titulo_descriptivo_evento(obj.evento)
        return "Alerta"

    def get_origen_tipo(self, obj):
        if obj.medicion_id:
            return "medicion"
        if obj.evento_id:
            return "evento"
        return None

    def get_cultivo_nombre(self, obj):
        # Por medición → sensor → (M2M cultivos) o dispositivo → cultivo
        if obj.medicion_id:
            try:
                sensor = obj.medicion.sensor
                cultivo = sensor.cultivos.first()
                if cultivo is None and sensor.dispositivo_id:
                    cultivo = sensor.dispositivo.cultivo
                return cultivo.nombre if cultivo else None
            except Exception:
                return None
        # Por evento → cultivo directo
        if obj.evento_id:
            return obj.evento.cultivo.nombre if obj.evento.cultivo else None
        return None

    def get_medicion_detalle(self, obj):
        if not obj.medicion_id:
            return None

        medicion = obj.medicion
        sensor = medicion.sensor
        tipo = sensor.tipo_sensor
        rango = _obtener_rango_vigente(sensor)

        cultivo = sensor.cultivos.first()
        if cultivo is None and sensor.dispositivo_id:
            cultivo = sensor.dispositivo.cultivo

        return {
            "id": medicion.id,
            "valor": medicion.valor,
            "unidad": tipo.unidad_medida,
            "sensor_nombre": tipo.nombre,
            "sensor_id": sensor.id,
            "dispositivo": sensor.dispositivo.nombre if sensor.dispositivo else None,
            "cultivo": cultivo.nombre if cultivo else None,
            "cultivo_id": cultivo.pk if cultivo else None,
            "estado_lectura": medicion.estado_lectura,
            "fecha_hora": medicion.fecha_hora,
            "rango_min": rango.valor_min if rango else None,
            "rango_max": rango.valor_max if rango else None,
            "desvio_pct": _calcular_desvio_pct(
                medicion.valor,
                rango.valor_min if rango else None,
                rango.valor_max if rango else None,
            ),
        }

    def get_evento_detalle(self, obj):
        if not obj.evento_id:
            return None

        evento = obj.evento
        return {
            "id": evento.id,
            "tipo_evento": evento.tipo_evento,
            "tipo_display": evento.get_tipo_evento_display(),
            "descripcion": evento.descripcion,
            "fecha_hora": evento.fecha_hora,
            "dispositivo": evento.dispositivo.nombre if evento.dispositivo else None,
            "cultivo": evento.cultivo.nombre if evento.cultivo else None,
        }

    def get_acciones_sugeridas(self, obj):
        if obj.medicion_id:
            return _acciones_sugeridas_medicion(obj.medicion)
        if obj.evento_id:
            return _acciones_sugeridas_evento(obj.evento)
        return []