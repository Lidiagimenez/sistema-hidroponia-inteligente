"""
Módulo de Inteligencia Artificial — Detección de anomalías.

Modelo: sklearn.ensemble.IsolationForest
Tipo:   Aprendizaje no supervisado (no requiere etiquetas).
Entrada: ventana de las últimas N mediciones de un tipo de sensor.
Salida:  score de anomalía (0.0 - 1.0) + flag booleano.

Cómo funciona:
  El Isolation Forest construye árboles de decisión aleatorios y mide
  cuán "fácil" es aislar cada observación. Los valores que se aíslan
  con menos divisiones son más anómalos. No necesita saber de antemano
  qué es normal y qué no: aprende el patrón de la distribución.

Por qué no usamos aprendizaje supervisado:
  No tenemos datasets etiquetados. Además, usar RangoOperacion para
  etiquetar automáticamente haría que la IA aprenda lo mismo que la
  regla fija, sin aportar valor. Isolation Forest aporta detección de
  patrones sutiles (tendencias, valores raros dentro del rango, etc.).

Persistencia:
  Cada tipo de sensor tiene su propio modelo entrenado, guardado en
  disco como archivo .joblib. Se reentrena cuando se ejecuta el
  management command `entrenar_modelos`.
"""

import logging
from datetime import timedelta
from pathlib import Path

import joblib
import numpy as np
from django.conf import settings
from django.utils import timezone
from sklearn.ensemble import IsolationForest


logger = logging.getLogger(__name__)


# =============================================================================
# Configuración
# =============================================================================

# Directorio donde se guardan los modelos entrenados
MODELO_DIR = Path(settings.BASE_DIR) / "ml_models"

# Contaminación esperada: proporción de anomalías en los datos (5%)
CONTAMINACION = 0.05

# Cantidad mínima de muestras para poder entrenar
MIN_MUESTRAS_ENTRENAMIENTO = 50

# Ventana temporal por defecto para entrenar (últimos 30 días)
VENTANA_ENTRENAMIENTO_DIAS = 30

# Umbral de score a partir del cual consideramos "anomalía"
UMBRAL_SCORE_ANOMALIA = 0.5


# =============================================================================
# Utilidades internas
# =============================================================================

def _ruta_modelo(tipo_sensor_id):
    """Devuelve la ruta del archivo .joblib para un tipo de sensor."""
    return MODELO_DIR / f"iforest_tipo_sensor_{tipo_sensor_id}.joblib"


def _mapear_score_a_prioridad(score):
    """
    Traduce el score de anomalía a una prioridad legible.
    Esto NO es una regla del motor: es una función de mapeo del
    resultado del modelo a un nivel cualitativo para el usuario.
    """
    if score >= 0.75:
        return "alta"
    if score >= 0.5:
        return "media"
    return "baja"


def _describir_anomalia(medicion, score):
    """Genera un texto legible que explique por qué se detectó la anomalía."""
    unidad = medicion.sensor.tipo_sensor.unidad_medida
    nombre = medicion.sensor.tipo_sensor.nombre
    return (
        f"El modelo de IA detectó un valor anómalo de "
        f"{medicion.valor} {unidad} en {nombre}. "
        f"Score de anomalía: {score:.2f}. "
        f"Este valor se aparta del patrón histórico del sensor."
    )


# =============================================================================
# Entrenamiento
# =============================================================================

def entrenar_modelo(tipo_sensor_id, ventana_dias=VENTANA_ENTRENAMIENTO_DIAS):
    """
    Entrena un Isolation Forest para un tipo de sensor.

    Solo se usan mediciones marcadas como "normal" para que el modelo
    aprenda la distribución esperada. Las mediciones fuera de rango
    operativo se excluyen del entrenamiento.

    Devuelve el modelo entrenado, o None si no hay suficientes datos.
    """
    from apps.monitoreo.models import Medicion

    hace = timezone.now() - timedelta(days=ventana_dias)

    valores = list(
        Medicion.objects
        .filter(
            sensor__tipo_sensor_id=tipo_sensor_id,
            fecha_hora__gte=hace,
            estado_lectura=Medicion.EstadoLectura.NORMAL,
        )
        .values_list("valor", flat=True)
    )

    if len(valores) < MIN_MUESTRAS_ENTRENAMIENTO:
        logger.warning(
            "Tipo sensor %s: solo %d mediciones (mínimo %d). No se entrena.",
            tipo_sensor_id, len(valores), MIN_MUESTRAS_ENTRENAMIENTO,
        )
        return None

    X = np.array(valores).reshape(-1, 1)

    modelo = IsolationForest(
        contamination=CONTAMINACION,
        n_estimators=100,
        random_state=42,
        n_jobs=-1,
    )
    modelo.fit(X)

    MODELO_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(modelo, _ruta_modelo(tipo_sensor_id))

    logger.info(
        "Modelo entrenado para tipo sensor %s con %d muestras.",
        tipo_sensor_id, len(valores),
    )
    return modelo


def cargar_modelo(tipo_sensor_id):
    """
    Carga el modelo desde disco. Si no existe, intenta entrenarlo.
    Devuelve el modelo o None si no se pudo cargar ni entrenar.
    """
    ruta = _ruta_modelo(tipo_sensor_id)
    if ruta.exists():
        try:
            return joblib.load(ruta)
        except Exception as e:
            logger.error("Error cargando modelo %s: %s", ruta, e)

    return entrenar_modelo(tipo_sensor_id)


# =============================================================================
# Evaluación
# =============================================================================

def evaluar_medicion(medicion):
    """
    Evalúa una medición contra el modelo entrenado de su tipo de sensor.

    Devuelve una tupla (score, es_anomalia):
      - score: float en [0.0, 1.0]. Mayor = más anómalo.
      - es_anomalia: bool.
    Si no hay modelo disponible, devuelve (None, False).

    Cómo se calcula el score:
      Usamos `decision_function`, que devuelve la distancia de la muestra
      al umbral interno del modelo. Valores positivos = normal, negativos
      = anómalo. La escala práctica está en [-0.15, 0.15], así que
      mapeamos a [0, 1] con la fórmula `0.5 - decision * 3`.

      No usamos `score_samples` directo porque su rango es muy estrecho
      y centrado en -0.5, lo que hace imposible normalizarlo sin conocer
      la distribución de los datos de entrenamiento.
    """
    modelo = cargar_modelo(medicion.sensor.tipo_sensor_id)
    if modelo is None:
        return None, False

    X = np.array([[medicion.valor]])

    try:
        # decision_function: positivo = normal, negativo = anómalo.
        # La escala es aproximadamente [-0.15, 0.15] en la práctica.
        decision = float(modelo.decision_function(X)[0])

        # Mapear a [0, 1]:
        #   decision = +0.15 → score ≈ 0.05 (muy normal)
        #   decision =  0.00 → score = 0.50 (borderline)
        #   decision = -0.15 → score ≈ 0.95 (muy anómalo)
        score = float(max(0.0, min(1.0, 0.5 - decision * 3)))

        # La decisión se deriva del score normalizado
        es_anomalia = score >= UMBRAL_SCORE_ANOMALIA
    except Exception as e:
        logger.error("Error evaluando medición %s: %s", medicion.pk, e)
        return None, False

    return score, es_anomalia

def detectar_y_registrar(medicion, umbral_score=UMBRAL_SCORE_ANOMALIA):
    """
    Detecta si una medición es anómala según el modelo y, si lo es,
    crea un registro Anomalia.

    Devuelve la Anomalia creada, o None si no se detectó nada.

    El umbral_score permite ajustar la sensibilidad: valores bajos
    generan más anomalías (más sensible), valores altos menos.
    """
    from apps.inteligencia.models import Anomalia

    score, es_anomalia = evaluar_medicion(medicion)
    if not es_anomalia or score is None or score < umbral_score:
        return None

    # Obtener el rango operativo para dar contexto
    rango = medicion.sensor.rangos.order_by("-vigente_desde").first()

    anomalia = Anomalia.objects.create(
        cultivo=medicion.sensor.dispositivo.cultivo,
        sensor=medicion.sensor,
        medicion=medicion,
        origen=Anomalia.OrigenDeteccion.MEDICION,
        score=score,
        valor_observado=medicion.valor,
        valor_esperado_min=rango.valor_min if rango else None,
        valor_esperado_max=rango.valor_max if rango else None,
        descripcion=_describir_anomalia(medicion, score),
        modelo_version="iforest-v1",
    )

    logger.info(
        "Anomalía detectada: sensor=%s, valor=%s, score=%.2f",
        medicion.sensor_id, medicion.valor, score,
    )
    return anomalia


# =============================================================================
# Operaciones batch
# =============================================================================

def entrenar_todos_los_modelos():
    """
    Entrena un modelo por cada tipo de sensor que tenga suficientes datos.
    Devuelve un dict {tipo_sensor_id: 'ok' | 'sin_datos' | 'error'}.
    """
    from apps.monitoreo.models import TipoSensor

    resultado = {}
    for tipo in TipoSensor.objects.all():
        try:
            modelo = entrenar_modelo(tipo.id)
            resultado[tipo.id] = "ok" if modelo else "sin_datos"
        except Exception as e:
            logger.error("Error entrenando tipo sensor %s: %s", tipo.id, e)
            resultado[tipo.id] = "error"
    return resultado


def evaluar_mediciones_recientes(horas=1, umbral_score=UMBRAL_SCORE_ANOMALIA):
    """
    Evalúa las mediciones de las últimas N horas y registra anomalías.
    Útil para correr en batch desde un management command.
    Devuelve la cantidad de anomalías creadas.
    """
    from apps.monitoreo.models import Medicion
    from apps.inteligencia.models import Anomalia

    hace = timezone.now() - timedelta(hours=horas)
    mediciones = (
        Medicion.objects
        .filter(fecha_hora__gte=hace)
        .select_related("sensor", "sensor__tipo_sensor", "sensor__dispositivo")
        .order_by("fecha_hora")
    )

    creadas = 0
    for medicion in mediciones:
        # Evitar duplicados: si ya existe una Anomalia para esta medicion, skip
        if Anomalia.objects.filter(medicion=medicion).exists():
            continue

        anomalia = detectar_y_registrar(medicion, umbral_score=umbral_score)
        if anomalia:
            creadas += 1
    return creadas