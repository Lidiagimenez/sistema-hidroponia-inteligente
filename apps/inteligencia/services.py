"""
Servicios de análisis de imagen + ingesta desde ESP32.

============================================================================
TODO — RETOMAMOS IMAGEN
============================================================================
La implementación real de `analizar_imagen` y `estimar_etapa` está pendiente.
Cuando se retome, hay que preguntar:
  - Distancia cámara y tipo de marcador.
  - Dónde corre el análisis (backend con OpenCV).
  - Qué cultivo es el principal.
Y luego implementar con OpenCV.
============================================================================
"""

import hashlib
from datetime import datetime, timedelta

import requests
from django.core.files.base import ContentFile
from django.utils import timezone


# =============================================================================
# Análisis de imagen (placeholder)
# =============================================================================

def analizar_imagen(imagen_field, parametro):
    """Placeholder hasta que se implemente OpenCV."""
    return {
        "altura_estimada_cm": None,
        "area_foliar_cm2": None,
        "indice_verdor": None,
        "cobertura_pct": None,
        "confianza": 0.0,
    }


def estimar_etapa(analisis):
    return "germinacion"


def calcular_delta_altura(analisis):
    from apps.inteligencia.models import AnalisisImagen

    if analisis.altura_estimada_cm is None:
        return None

    anterior = (
        AnalisisImagen.objects
        .filter(cultivo=analisis.cultivo, fecha_hora__lt=analisis.fecha_hora)
        .exclude(pk=analisis.pk)
        .order_by("-fecha_hora")
        .first()
    )
    if not anterior or anterior.altura_estimada_cm is None:
        return None
    return round(analisis.altura_estimada_cm - anterior.altura_estimada_cm, 2)


def evaluar_avisos(analisis):
    return []


def procesar_analisis(analisis):
    try:
        parametro = analisis.cultivo.parametro_imagen
    except Exception:
        from apps.inteligencia.models import ParametroImagen
        parametro = ParametroImagen.objects.create(cultivo=analisis.cultivo)

    metricas = analizar_imagen(analisis.imagen, parametro)
    for campo, valor in metricas.items():
        setattr(analisis, campo, valor)

    analisis.etapa_fenologica = estimar_etapa(analisis)
    analisis.delta_altura_cm = calcular_delta_altura(analisis)
    analisis.procesada = True
    analisis.save()

    evaluar_avisos(analisis)
    return analisis


# =============================================================================
# Ingesta desde ESP32 (polling)
# =============================================================================

def _url_captura_de(dispositivo):
    if getattr(dispositivo, "url_captura", None):
        return dispositivo.url_captura
    if getattr(dispositivo, "ip_local", None):
        return f"http://{dispositivo.ip_local}/capture"
    return None


def _hash(contenido_bytes):
    return hashlib.sha256(contenido_bytes).hexdigest()


def traer_captura(dispositivo, origen="periodica"):
    """GET /capture del ESP32 → AnalisisImagen."""
    from apps.inteligencia.models import AnalisisImagen, ParametroImagen

    url = _url_captura_de(dispositivo)
    if not url:
        return None

    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
    except requests.RequestException:
        return None

    contenido = r.content
    hash_ = _hash(contenido)

    if AnalisisImagen.objects.filter(hash_sha256=hash_).exists():
        return None

    cultivo = getattr(dispositivo, "cultivo", None)
    if cultivo is None:
        return None

    try:
        parametro = cultivo.parametro_imagen
    except ParametroImagen.DoesNotExist:
        parametro = ParametroImagen.objects.create(cultivo=cultivo)

    analisis = AnalisisImagen(
        cultivo=cultivo,
        dispositivo=dispositivo,
        fecha_hora=timezone.now(),
        origen_captura=origen,
        hash_sha256=hash_,
    )
    nombre = f"{dispositivo.id}_{analisis.fecha_hora:%Y%m%d_%H%M%S}.jpg"
    analisis.imagen.save(nombre, ContentFile(contenido), save=False)
    analisis.save()

    procesar_analisis(analisis)
    return analisis


def traer_capturas_de_todos():
    from apps.dispositivos.models import Dispositivo

    dispositivos = Dispositivo.objects.filter(permite_polling=True, activo=True)
    resultado = {"ok": 0, "error": 0, "sin_url": 0}
    for d in dispositivos:
        if not _url_captura_de(d):
            resultado["sin_url"] += 1
            continue
        captura = traer_captura(d)
        if captura:
            resultado["ok"] += 1
        else:
            resultado["error"] += 1
    return resultado


# =============================================================================
# Sincronización de huecos desde SD
# =============================================================================

def listar_fotos_sd(dispositivo, desde=None, hasta=None):
    """GET /list del ESP32 (lista archivos en la SD)."""
    if not getattr(dispositivo, "ip_local", None):
        return []

    params = {}
    if desde:
        params["desde"] = desde.isoformat()
    if hasta:
        params["hasta"] = hasta.isoformat()

    try:
        r = requests.get(f"http://{dispositivo.ip_local}/list",
                         params=params, timeout=15)
        r.raise_for_status()
        return r.json()
    except (requests.RequestException, ValueError):
        return []


def descargar_foto_sd(dispositivo, nombre_archivo):
    if not getattr(dispositivo, "ip_local", None):
        return None
    try:
        r = requests.get(f"http://{dispositivo.ip_local}/download",
                         params={"archivo": nombre_archivo}, timeout=30)
        r.raise_for_status()
        return r.content
    except requests.RequestException:
        return None


def sincronizar_desde_sd(dispositivo, dias_atras=1):
    from apps.inteligencia.models import AnalisisImagen, ParametroImagen

    cultivo = getattr(dispositivo, "cultivo", None)
    if cultivo is None:
        return 0

    desde = timezone.now() - timedelta(days=dias_atras)
    fotos_sd = listar_fotos_sd(dispositivo, desde=desde)
    if not fotos_sd:
        return 0

    recuperadas = 0
    for foto in fotos_sd:
        nombre = foto.get("nombre")
        fecha_str = foto.get("fecha")
        if not nombre or not fecha_str:
            continue
        try:
            fecha = datetime.fromisoformat(fecha_str)
            if timezone.is_naive(fecha):
                fecha = timezone.make_aware(fecha)
        except ValueError:
            continue

        existe = AnalisisImagen.objects.filter(
            cultivo=cultivo,
            dispositivo=dispositivo,
            fecha_hora__gte=fecha - timedelta(seconds=30),
            fecha_hora__lte=fecha + timedelta(seconds=30),
        ).exists()
        if existe:
            continue

        contenido = descargar_foto_sd(dispositivo, nombre)
        if not contenido:
            continue

        hash_ = _hash(contenido)
        if AnalisisImagen.objects.filter(hash_sha256=hash_).exists():
            continue

        try:
            parametro = cultivo.parametro_imagen
        except ParametroImagen.DoesNotExist:
            parametro = ParametroImagen.objects.create(cultivo=cultivo)

        analisis = AnalisisImagen(
            cultivo=cultivo, dispositivo=dispositivo,
            fecha_hora=fecha, origen_captura="sync_sd", hash_sha256=hash_,
        )
        analisis.imagen.save(nombre, ContentFile(contenido), save=False)
        analisis.save()
        procesar_analisis(analisis)
        recuperadas += 1

    return recuperadas


def sincronizar_todos_desde_sd(dias_atras=1):
    from apps.dispositivos.models import Dispositivo
    total = 0
    for d in Dispositivo.objects.filter(permite_polling=True, activo=True):
        total += sincronizar_desde_sd(d, dias_atras=dias_atras)
    return total


# =============================================================================
# Limpieza
# =============================================================================

def limpiar_imagenes_antiguas():
    from apps.inteligencia.models import AnalisisImagen
    from apps.cultivos.models import Cultivo

    total = 0
    ahora = timezone.now()

    for cultivo in Cultivo.objects.all():
        try:
            dias = cultivo.parametro_imagen.retencion_dias
        except Exception:
            dias = 7
        limite = ahora - timedelta(days=dias)
        borradas, _ = (
            AnalisisImagen.objects
            .filter(cultivo=cultivo, fecha_hora__lt=limite)
            .delete()
        )
        total += borradas
    return total