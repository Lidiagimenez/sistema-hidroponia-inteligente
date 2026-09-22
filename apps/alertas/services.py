from apps.monitoreo.models import Medicion
from apps.alertas.models import ParametroAlerta, Alerta


def calcular_severidad_por_desviacion(valor, valor_min, valor_max, umbral_desviacion_alta):
    """RF-36: % de desvío respecto al límite más cercano."""
    limite_cercano = valor_min if abs(valor - valor_min) < abs(valor - valor_max) else valor_max
    desvio_pct = abs(valor - limite_cercano) / abs(limite_cercano) * 100 if limite_cercano else 100
    if desvio_pct >= umbral_desviacion_alta:
        return Alerta.Severidad.ALTA
    elif desvio_pct >= umbral_desviacion_alta / 2:
        return Alerta.Severidad.MEDIA
    return Alerta.Severidad.BAJA


def verificar_lecturas_consecutivas_y_generar_alerta(sensor):
    """RF-21 + RNF-13 (anti-flapping)."""
    parametro = ParametroAlerta.objects.filter(tipo_sensor=sensor.tipo_sensor).first()
    if not parametro:
        return None

    n_apertura = parametro.lecturas_consecutivas_apertura
    ultimas = list(sensor.mediciones.order_by("-fecha_hora")[:n_apertura])
    if len(ultimas) < n_apertura:
        return None

    todas_fuera_de_rango = all(m.estado_lectura == Medicion.EstadoLectura.FUERA_RANGO for m in ultimas)
    if not todas_fuera_de_rango:
        return None

    alerta_existente = Alerta.objects.filter(
        medicion__sensor=sensor, estado=Alerta.Estado.ACTIVA,
    ).exists()
    if alerta_existente:
        return None

    rango = sensor.rangos.order_by("-vigente_desde").first()
    severidad = calcular_severidad_por_desviacion(
        ultimas[0].valor, rango.valor_min, rango.valor_max, parametro.umbral_desviacion_alta,
    ) if rango else Alerta.Severidad.MEDIA

    return Alerta.objects.create(medicion=ultimas[0], severidad=severidad)


def verificar_cierre_por_lecturas_normales(sensor):
    """Cierre automático de RF-21, mismo N pero de cierre."""
    parametro = ParametroAlerta.objects.filter(tipo_sensor=sensor.tipo_sensor).first()
    if not parametro:
        return

    n_cierre = parametro.lecturas_consecutivas_cierre
    ultimas = list(sensor.mediciones.order_by("-fecha_hora")[:n_cierre])
    if len(ultimas) < n_cierre:
        return

    todas_normales = all(m.estado_lectura == Medicion.EstadoLectura.NORMAL for m in ultimas)
    if todas_normales:
        from django.utils import timezone
        Alerta.objects.filter(
            medicion__sensor=sensor, estado=Alerta.Estado.ACTIVA,
        ).update(estado=Alerta.Estado.RESUELTA, fecha_hora_fin=timezone.now())