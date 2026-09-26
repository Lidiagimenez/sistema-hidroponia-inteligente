"""
Motor de recomendaciones basado en reglas.

IMPORTANTE: no es "IA". No hay modelo entrenado, ni dataset, ni inferencia.
Son reglas explícitas que combinan sensores + análisis de imagen.
"""

from datetime import timedelta

from django.utils import timezone


REGLAS = []


def regla(id_, condicion, tipo, prioridad, titulo, detalle):
    REGLAS.append({
        "id": id_,
        "condicion": condicion,
        "tipo": tipo,
        "prioridad": prioridad,
        "titulo": titulo,
        "detalle": detalle,
    })


# =============================================================================
# Constructor de contexto
# =============================================================================

def construir_contexto(cultivo):
    from apps.monitoreo.models import Medicion
    from apps.inteligencia.models import AnalisisImagen

    ahora = timezone.now()
    hace_24h = ahora - timedelta(hours=24)
    hace_7d = ahora - timedelta(days=7)

    ultimas = {}
    for m in (
        Medicion.objects
        .filter(sensor__dispositivo__cultivo=cultivo)
        .select_related("sensor", "sensor__tipo_sensor")
        .order_by("-fecha_hora")[:200]
    ):
        nombre = m.sensor.tipo_sensor.nombre.lower()
        if nombre not in ultimas:
            ultimas[nombre] = m

    promedios = {}
    for m in (
        Medicion.objects
        .filter(sensor__dispositivo__cultivo=cultivo, fecha_hora__gte=hace_24h)
        .select_related("sensor", "sensor__tipo_sensor")
    ):
        nombre = m.sensor.tipo_sensor.nombre.lower()
        promedios.setdefault(nombre, []).append(m.valor)

    for k, valores in promedios.items():
        promedios[k] = sum(valores) / len(valores) if valores else None

    ultimo_analisis = (
        AnalisisImagen.objects
        .filter(cultivo=cultivo)
        .order_by("-fecha_hora")
        .first()
    )

    tendencia = None
    analisis_7d = list(
        AnalisisImagen.objects
        .filter(
            cultivo=cultivo,
            fecha_hora__gte=hace_7d,
            altura_estimada_cm__isnull=False,
        )
        .order_by("fecha_hora")
    )
    if len(analisis_7d) >= 2:
        primera = analisis_7d[0].altura_estimada_cm
        ultima = analisis_7d[-1].altura_estimada_cm
        dias = (analisis_7d[-1].fecha_hora - analisis_7d[0].fecha_hora).days or 1
        tendencia = {
            "delta_cm": ultima - primera,
            "delta_por_dia_cm": (ultima - primera) / dias,
            "dias_sin_crecer": _dias_sin_crecer(analisis_7d),
        }

    return {
        "cultivo": cultivo,
        "ahora": ahora,
        "ultimas_mediciones": ultimas,
        "promedios_24h": promedios,
        "ultimo_analisis": ultimo_analisis,
        "tendencia_crecimiento": tendencia,
    }


def _dias_sin_crecer(analisis_ordenados):
    if len(analisis_ordenados) < 2:
        return 0
    dias = 0
    for i in range(len(analisis_ordenados) - 1, 0, -1):
        actual = analisis_ordenados[i].altura_estimada_cm
        previo = analisis_ordenados[i - 1].altura_estimada_cm
        if actual is None or previo is None:
            break
        if actual <= previo + 0.05:
            delta_dias = (analisis_ordenados[i].fecha_hora - analisis_ordenados[i - 1].fecha_hora).days
            dias += max(delta_dias, 1)
        else:
            break
    return dias


# =============================================================================
# Reglas
# =============================================================================

def _ph_bajo(ctx):
    m = ctx["ultimas_mediciones"].get("ph")
    return m is not None and m.valor < 5.5

def _ph_alto(ctx):
    m = ctx["ultimas_mediciones"].get("ph")
    return m is not None and m.valor > 7.5

def _conductividad_alta(ctx):
    m = ctx["ultimas_mediciones"].get("conductividad")
    return m is not None and m.valor > 2.5

def _conductividad_baja(ctx):
    m = ctx["ultimas_mediciones"].get("conductividad")
    return m is not None and m.valor < 0.8

def _temperatura_alta_con_humedad(ctx):
    t = ctx["ultimas_mediciones"].get("temperatura")
    h = ctx["ultimas_mediciones"].get("humedad")
    return t is not None and h is not None and t.valor > 30 and h.valor > 70

def _sin_crecimiento_con_verdor_ok(ctx):
    tend = ctx["tendencia_crecimiento"]
    ult = ctx["ultimo_analisis"]
    if not tend or not ult:
        return False
    return tend["dias_sin_crecer"] >= 3 and (ult.indice_verdor is None or ult.indice_verdor > 0.3)

def _sin_crecimiento_con_verdor_bajo(ctx):
    tend = ctx["tendencia_crecimiento"]
    ult = ctx["ultimo_analisis"]
    if not tend or not ult or ult.indice_verdor is None:
        return False
    return tend["dias_sin_crecer"] >= 3 and ult.indice_verdor <= 0.3

def _crecimiento_acelerado(ctx):
    tend = ctx["tendencia_crecimiento"]
    return tend is not None and tend["delta_por_dia_cm"] > 1.5


regla("ph_bajo", _ph_bajo, "ph", "alta",
      "pH bajo detectado",
      "El pH está por debajo de 5.5. Agregar solución alcalina.")
regla("ph_alto", _ph_alto, "ph", "alta",
      "pH alto detectado",
      "El pH está por encima de 7.5. Agregar solución ácida.")
regla("conductividad_alta", _conductividad_alta, "conductividad", "media",
      "Conductividad elevada",
      "Supera 2.5 mS/cm. Diluir la solución nutritiva.")
regla("conductividad_baja", _conductividad_baja, "conductividad", "media",
      "Conductividad baja",
      "Por debajo de 0.8 mS/cm. Reforzar solución nutritiva.")
regla("temp_alta_humedad_alta", _temperatura_alta_con_humedad, "temperatura", "alta",
      "Riesgo de hongos",
      "Temperatura >30 °C con humedad >70 %. Ventilar.")
regla("sin_crecimiento_verdor_ok", _sin_crecimiento_con_verdor_ok, "crecimiento", "media",
      "Sin crecimiento aparente",
      "La planta no creció pero se ve verde. Revisar iluminación.")
regla("sin_crecimiento_verdor_bajo", _sin_crecimiento_con_verdor_bajo, "crecimiento", "alta",
      "Sin crecimiento y verdor bajo",
      "Posible deficiencia nutricional o estrés.")
regla("crecimiento_acelerado", _crecimiento_acelerado, "crecimiento", "baja",
      "Crecimiento acelerado",
      "Evaluar si conviene pasar a la siguiente etapa.")


# =============================================================================
# Evaluación
# =============================================================================

def evaluar_recomendaciones(cultivo, throttle_horas=6):
    from apps.inteligencia.models import Recomendacion

    ctx = construir_contexto(cultivo)
    generadas = []
    limite = timezone.now() - timedelta(hours=throttle_horas)

    for r in REGLAS:
        try:
            aplica = r["condicion"](ctx)
        except Exception:
            aplica = False
        if not aplica:
            continue

        if Recomendacion.objects.filter(
            cultivo=cultivo,
            regla_origen=r["id"],
            vigente=True,
            resuelta=False,
            fecha__gte=limite,
        ).exists():
            continue

        generadas.append(Recomendacion.objects.create(
            cultivo=cultivo,
            tipo=r["tipo"],
            prioridad=r["prioridad"],
            titulo=r["titulo"],
            detalle=r["detalle"],
            regla_origen=r["id"],
        ))
    return generadas


def evaluar_todos_los_cultivos():
    from apps.cultivos.models import Cultivo
    total = 0
    for cultivo in Cultivo.objects.all():
        total += len(evaluar_recomendaciones(cultivo))
    return total