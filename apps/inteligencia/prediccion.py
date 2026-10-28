"""
Módulo de Predicción — Forecasting con Machine Learning.
 
Modelo: sklearn.ensemble.RandomForestRegressor (o alternativa)
Objetivo: Predecir el siguiente valor de un sensor basado en su historial.
 
Entrenamiento:
  - Usa las últimas N mediciones de un sensor/tipo de sensor para crear secuencias
  - X: ventana deslizante de tamaño VENTANA_PREDICCION (ej. 10 valores pasados)
  - Y: valor siguiente
  - Guarda modelo en ml_models/rf_prediccion_tipo_sensor_<id>.joblib

Fallback:
  - Si hay menos de MIN_MUESTRAS_PREDICCION mediciones, o no existe modelo,
    se usa media móvil de las últimas 5 mediciones.
"""

import logging
from datetime import timedelta
from pathlib import Path
from typing import Optional, Tuple

import joblib
import numpy as np
from django.conf import settings
from django.utils import timezone
from sklearn.ensemble import RandomForestRegressor

from apps.monitoreo.models import Medicion, Sensor, TipoSensor

logger = logging.getLogger(__name__)

# Directorio donde se guardan los modelos entrenados
MODELO_DIR = Path(settings.BASE_DIR) / "ml_models"

# Configuración
VENTANA_PREDICCION = 10  # Número de mediciones pasadas para predecir la siguiente
MIN_MUESTRAS_PREDICCION = 50  # Mínimo para entrenar modelo
MIN_MUESTRAS_FALLBACK = 1  # Mínimo para usar media móvil
VENTANA_ENTRENAMIENTO_DIAS = 30  # Días de histórico

# Cache para evitar spam de warnings
_tipos_sin_datos_pred_warning = set()


def _ruta_modelo_rf(tipo_sensor_id):
    """Devuelve la ruta del archivo .joblib para el modelo RF de un tipo de sensor."""
    return MODELO_DIR / f"rf_prediccion_tipo_sensor_{tipo_sensor_id}.joblib"


def _crear_secuencias(valores, ventana=VENTANA_PREDICCION):
    """
    Crea secuencias deslizantes para entrenamiento supervisado.
    X: [v_t-n, ..., v_t-1]
    Y: [v_t]
    """
    if len(valores) < ventana + 1:
        return None, None
    
    X, y = [], []
    for i in range(len(valores) - ventana):
        X.append(valores[i:i + ventana])
        y.append(valores[i + ventana])
    
    return np.array(X), np.array(y)


def entrenar_modelo_prediccion(tipo_sensor_id, ventana_dias=VENTANA_ENTRENAMIENTO_DIAS):
    """
    Entrena un modelo Random Forest para predecir el siguiente valor.
    
    Devuelve el modelo entrenado, o None si no hay suficientes datos.
    """
    hace = timezone.now() - timedelta(days=ventana_dias)
    
    # Obtener valores ordenados cronológicamente
    valores_qs = (
        Medicion.objects
        .filter(
            sensor__tipo_sensor_id=tipo_sensor_id,
            fecha_hora__gte=hace,
        )
        .order_by("fecha_hora")
        .values_list("valor", flat=True)
    )
    
    valores = list(valores_qs)
    
    if len(valores) < MIN_MUESTRAS_PREDICCION:
        if tipo_sensor_id not in _tipos_sin_datos_pred_warning:
            logger.warning(
                "Tipo sensor %s (predicción): solo %d mediciones (mínimo %d). No se entrena RF.",
                tipo_sensor_id, len(valores), MIN_MUESTRAS_PREDICCION,
            )
            _tipos_sin_datos_pred_warning.add(tipo_sensor_id)
        return None
    
    X, y = _crear_secuencias(valores, ventana=VENTANA_PREDICCION)
    
    if X is None or len(X) == 0:
        logger.warning(
            "Tipo sensor %s (predicción): no se pudieron crear secuencias con ventana %d.",
            tipo_sensor_id, VENTANA_PREDICCION
        )
        return None
    
    modelo = RandomForestRegressor(
        n_estimators=100,
        random_state=42,
        n_jobs=-1,
        max_depth=10,
    )
    modelo.fit(X, y)
    
    MODELO_DIR.mkdir(parents=True, exist_ok=True)
    ruta = _ruta_modelo_rf(tipo_sensor_id)
    joblib.dump(modelo, ruta)
    
    logger.info(
        "Modelo RF de predicción entrenado para tipo sensor %s con %d secuencias.",
        tipo_sensor_id, len(X),
    )
    return modelo


def cargar_modelo_prediccion(tipo_sensor_id):
    """
    Carga el modelo de predicción desde disco. Si no existe, intenta entrenarlo.
    Devuelve el modelo o None si no se pudo cargar ni entrenar.
    """
    ruta = _ruta_modelo_rf(tipo_sensor_id)
    if ruta.exists():
        try:
            return joblib.load(ruta)
        except Exception as e:
            logger.error("Error cargando modelo RF %s: %s", ruta, e)
    
    return entrenar_modelo_prediccion(tipo_sensor_id)


def predecir_siguiente(sensor_id=None, tipo_sensor_id=None, cultivo_id=None):
    """
    Predice el siguiente valor para un sensor.
    
    Puede buscar por sensor_id directamente, o por tipo_sensor_id,
    o encontrar sensores asociados a un cultivo.
    
    Retorna información de predicción o None si no hay datos suficientes.
    """
    from apps.monitoreo.models import Sensor
    
    sensor = None
    if sensor_id:
        sensor = Sensor.objects.select_related("tipo_sensor", "dispositivo").filter(pk=sensor_id).first()
    elif tipo_sensor_id:
        # Buscar cualquier sensor activo de este tipo
        sensor = (
            Sensor.objects
            .select_related("tipo_sensor", "dispositivo")
            .filter(tipo_sensor_id=tipo_sensor_id, is_active=True)
            .first()
        )
    elif cultivo_id:
        # Buscar sensores asociados al cultivo
        sensor = (
            Sensor.objects
            .select_related("tipo_sensor", "dispositivo")
            .filter(cultivos__pk=cultivo_id, is_active=True)
            .first()
        )
    
    if not sensor:
        return None
    
    tipo_sensor = sensor.tipo_sensor
    
    # Obtener últimas mediciones ordenadas cronológicamente
    mediciones = list(
        Medicion.objects
        .filter(sensor=sensor)
        .order_by("fecha_hora")
        .values_list("valor", flat=True)
    )
    
    if not mediciones:
        return None
    
    valor_actual = mediciones[-1]
    
    prediccion = None
    usado_fallback = False
    
    # Intentar usar modelo entrenado
    modelo = cargar_modelo_prediccion(tipo_sensor.id)
    
    if modelo is not None and len(mediciones) >= VENTANA_PREDICCION:
        try:
            # Tomar últimas N mediciones como entrada
            ventana = np.array(mediciones[-VENTANA_PREDICCION:]).reshape(1, -1)
            prediccion = float(modelo.predict(ventana)[0])
        except Exception as e:
            logger.error("Error prediciendo con modelo RF para sensor %s: %s", sensor.id, e)
            prediccion = None
    
    # FALLBACK: Si no hay modelo o hay pocos datos, usar media móvil de las últimas 5
    if prediccion is None:
        if len(mediciones) >= MIN_MUESTRAS_FALLBACK:
            ultimas_5 = mediciones[-5:] if len(mediciones) >= 5 else mediciones
            prediccion = float(np.mean(ultimas_5))
            usado_fallback = True
        else:
            return None
    
    # Determinar tendencia
    if prediccion > valor_actual + 0.01:  # Pequeño umbral para evitar fluctuaciones
        tendencia = "subiendo"
        mensaje = f"Se espera un leve aumento del {tipo_sensor.nombre} en la próxima medición."
    elif prediccion < valor_actual - 0.01:
        tendencia = "bajando"
        mensaje = f"Se espera una leve bajada del {tipo_sensor.nombre} en la próxima medición."
    else:
        tendencia = "estable"
        mensaje = f"Se espera que el {tipo_sensor.nombre} se mantenga estable en la próxima medición."
    
    return {
        "sensor_id": sensor.id,
        "tipo_sensor": tipo_sensor.nombre,
        "valor_actual": round(float(valor_actual), 2),
        "prediccion": round(float(prediccion), 2),
        "tendencia": tendencia,
        "mensaje": mensaje,
        "usado_fallback": usado_fallback,
    }


def predecir_para_cultivo(cultivo_id):
    """
    Obtiene predicciones para todos los sensores asociados a un cultivo.
    """
    from apps.monitoreo.models import Sensor
    
    sensores = Sensor.objects.filter(cultivos__pk=cultivo_id, is_active=True)
    resultados = []
    
    for sensor in sensores:
        pred = predecir_siguiente(sensor_id=sensor.id)
        if pred:
            resultados.append(pred)
    
    return resultados


def entrenar_todos_modelos_prediccion(ventana_dias=VENTANA_ENTRENAMIENTO_DIAS):
    """
    Entrena un modelo de predicción RF por cada tipo de sensor que tenga suficientes datos.
    Devuelve un dict {tipo_sensor_id: 'ok' | 'sin_datos' | 'error'}.
    """
    resultado = {}
    for tipo in TipoSensor.objects.all():
        try:
            modelo = entrenar_modelo_prediccion(tipo.id, ventana_dias=ventana_dias)
            resultado[tipo.id] = "ok" if modelo else "sin_datos"
        except Exception as e:
            logger.error("Error entrenando modelo RF de predicción para tipo sensor %s: %s", tipo.id, e)
            resultado[tipo.id] = "error"
    return resultado
