from rest_framework.permissions import BasePermission


class EsAdministrador(BasePermission):
    message = "Solo un Administrador puede realizar esta acción."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.rol == request.user.Rol.ADMINISTRADOR
        )


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