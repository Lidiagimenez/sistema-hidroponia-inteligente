import logging

from .models import RegistroAuditoria

logger = logging.getLogger("auditoria")


def obtener_ip(request):
    """
    Extrae la IP real del cliente. Detrás de un proxy (nginx, etc.) se usa la
    primera IP del header X-Forwarded-For; en desarrollo REMOTE_ADDR.
    """
    if request is None:
        return None

    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def registrar_auditoria(request, accion, entidad, objeto_id=None, detalles=None, usuario=None):
    """
    Punto único de registro de auditoría. Validador principal:

    - NUNCA rompe el flujo de negocio: si el registro falla, solo se loguea
      el error (el sistema NO depende de que la auditoría funcione).
    - usuario: se toma de request.user si hay sesión autenticada. Se puede
      pasar explícito para casos como el login (en el que request.user
      todavía es anónimo pero ya validamos las credenciales).
    - Para LOGIN_FALLIDO el usuario va a NULL y el username intentado queda
      en detalles (no le creamos un FK a alguien que quizás ni exista).
    """
    try:
        user = usuario if usuario is not None else getattr(request, "user", None)
        es_usuario_valido = bool(getattr(user, "is_authenticated", False))

        RegistroAuditoria.objects.create(
            usuario=user if es_usuario_valido else None,
            accion=accion,
            entidad=entidad,
            objeto_id=objeto_id,
            detalles=detalles or {},
            ip_address=obtener_ip(request),
        )
    except Exception:  # noqa: BLE001 — la auditoría jamás debe frenar una acción real
        logger.exception("No se pudo registrar la acción '%s' sobre '%s' (#%s)", accion, entidad, objeto_id)