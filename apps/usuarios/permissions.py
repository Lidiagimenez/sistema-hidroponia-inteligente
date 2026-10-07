from rest_framework.permissions import BasePermission, SAFE_METHODS


class SoloLecturaParaOperador(BasePermission):
    """
    GET/HEAD/OPTIONS: admin y operador.
    POST/PUT/PATCH/DELETE: solo admin.
    """
    message = "Un Operador solo puede consultar información."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        # Superuser de Django puede todo
        if request.user.is_superuser:
            return True

        # Admin app puede todo
        if request.user.rol == "administrador":
            return True

        # Operador solo lectura
        if request.method in SAFE_METHODS:
            return True

        return False


class EsAdministrador(BasePermission):
    message = "Solo un Administrador puede realizar esta acción."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        # Superuser de Django pasa siempre (aunque su rol sea operador)
        if request.user.is_superuser:
            return True

        return request.user.rol == request.user.Rol.ADMINISTRADOR


class EsOperador(BasePermission):
    message = "Solo un Operador puede realizar esta acción."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.rol == request.user.Rol.OPERADOR
        )


class EsAdministradorOOperador(BasePermission):
    """Para endpoints de lectura que ambos roles pueden usar."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)