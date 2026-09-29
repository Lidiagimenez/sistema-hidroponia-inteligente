from rest_framework import authentication, exceptions
from rest_framework.permissions import BasePermission

from apps.dispositivos.models import Dispositivo


class DispositivoAutenticado:
    """
    Objeto que DRF usa como request.user cuando quien llama es un dispositivo.
    No es un Usuario: por eso NO pasa las permissions de roles (EsAdministrador, etc.).
    """
    is_authenticated = True
    is_anonymous = False

    def __init__(self, dispositivo):
        self.dispositivo = dispositivo

    def __str__(self):
        return f"Dispositivo({self.dispositivo.identificador_hardware})"


class DispositivoAPIKeyAuthentication(authentication.BaseAuthentication):
    """
    El dispositivo manda el header:  X-API-Key: <clave>
    Se compara el hash SHA-256 contra Dispositivo.api_key_hash.
    """
    header = "HTTP_X_API_KEY"

    def authenticate(self, request):
        clave = request.META.get(self.header)
        if not clave:
            return None  # no intentó autenticarse como dispositivo

        dispositivo = Dispositivo.objects.filter(
            api_key_hash=Dispositivo.hashear_api_key(clave)
        ).first()
        if dispositivo is None:
            raise exceptions.AuthenticationFailed("API key inválida.")
        if not dispositivo.esta_activo:
            raise exceptions.AuthenticationFailed("Dispositivo inactivo.")
        return (DispositivoAutenticado(dispositivo), dispositivo)

    def authenticate_header(self, request):
        return "X-API-Key"


class EsDispositivo(BasePermission):
    message = "Este endpoint es solo para dispositivos con API key."

    def has_permission(self, request, view):
        return isinstance(request.user, DispositivoAutenticado)
