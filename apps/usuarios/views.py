from django.conf import settings
from rest_framework import viewsets, status, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.auditoria.mixins import AuditableSerializerMixin
from apps.auditoria.models import RegistroAuditoria
from apps.auditoria.services import registrar_auditoria
from apps.usuarios.models import Usuario
from apps.usuarios.permissions import EsAdministrador
from apps.usuarios.serializers import (
    CustomTokenObtainPairSerializer,
    UsuarioMeSerializer,
    UsuarioSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            _set_jwt_cookies(response, response.data.get("access"), response.data.get("refresh"))
            response.data.pop("access", None)
            response.data.pop("refresh", None)
        return response


class CookieTokenRefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refresh"

    def post(self, request, *args, **kwargs):
        data = request.data.copy()
        if not data.get("refresh"):
            data["refresh"] = request.COOKIES.get(settings.JWT_REFRESH_COOKIE, "")

        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])

        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        if response.status_code == status.HTTP_200_OK:
            _set_jwt_cookies(
                response,
                response.data.get("access"),
                response.data.get("refresh") or request.COOKIES.get(settings.JWT_REFRESH_COOKIE),
            )
            response.data.pop("access", None)
            response.data.pop("refresh", None)
            response.data["detail"] = "Token renovado."
        return response


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Cierre de sesión: se audita siempre que haya usuario identificado,
        # aunque el token a eliminar ya no exista (double log-out).
        if getattr(request.user, "is_authenticated", False):
            registrar_auditoria(
                request,
                RegistroAuditoria.Accion.LOGOUT,
                "Usuario",
                objeto_id=request.user.pk,
                detalles={"username": request.user.username},
            )
        try:
            refresh_token = request.data.get("refresh") or request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            response = Response(status=status.HTTP_205_RESET_CONTENT)
            _delete_jwt_cookies(response)
            return response
        except Exception:
            return Response(status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    """Devuelve quién sos y qué rol tenés. Lo usa el frontend al recargar."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UsuarioMeSerializer(request.user).data)


class UsuarioViewSet(AuditableSerializerMixin, viewsets.ModelViewSet):
    """
    Solo el administrador puede gestionar usuarios (RF-02).
    El operador no tiene acceso a nada de acá.
    """
    auditar_entidad = "Usuario"
    queryset = Usuario.objects.all().order_by("pk")
    serializer_class = UsuarioSerializer
    permission_classes = [EsAdministrador]

    def get_queryset(self):
        qs = super().get_queryset()
        incluir_inactivos = self.request.query_params.get("incluir_inactivos") in ("1", "true", "True")
        if self.action == "list" and not incluir_inactivos:
            qs = qs.filter(is_active=True)
        return qs

    def perform_destroy(self, instance):
        # No permitir auto-desactivación
        if self.request.user.pk == instance.pk:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "No podés desactivar tu propia cuenta."})
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        # Borrado lógico: la auditoría lo marca como "eliminar (desactivación)".
        self._registrar_accion(
            RegistroAuditoria.Accion.ELIMINAR,
            instance,
            detalles={"modo": "desactivacion", "nota": "No se borra: queda desactivado para conservar el historial."},
        )

    @action(detail=True, methods=["post"])
    def desactivar(self, request, pk=None):
        usuario = self.get_object()
        if request.user.pk == usuario.pk:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "No podés desactivar tu propia cuenta."})
        if usuario.rol == Usuario.Rol.ADMINISTRADOR:
            admins_activos = Usuario.objects.filter(rol=Usuario.Rol.ADMINISTRADOR, is_active=True).count()
            if admins_activos <= 1:
                from rest_framework.exceptions import ValidationError

                raise ValidationError({"detail": "No podés desactivar al último administrador activo."})
        usuario.is_active = False
        usuario.save(update_fields=["is_active"])
        self._registrar_accion(
            RegistroAuditoria.Accion.EDITAR,
            usuario,
            detalles={"modo": "desactivar", "campos_modificados": ["is_active"]},
        )
        return Response(self.get_serializer(usuario).data)

    @action(detail=True, methods=["post"])
    def activar(self, request, pk=None):
        usuario = self.get_object()
        usuario.is_active = True
        usuario.save(update_fields=["is_active"])
        self._registrar_accion(
            RegistroAuditoria.Accion.EDITAR,
            usuario,
            detalles={"modo": "activar", "campos_modificados": ["is_active"]},
        )
        return Response(self.get_serializer(usuario).data)


def _set_jwt_cookies(response, access, refresh):
    cookie_kwargs = {
        "httponly": True,
        "secure": settings.JWT_COOKIE_SECURE,
        "samesite": settings.JWT_COOKIE_SAMESITE,
        "path": "/",
    }
    if access:
        response.set_cookie(settings.JWT_ACCESS_COOKIE, access, max_age=15 * 60, **cookie_kwargs)
    if refresh:
        response.set_cookie(settings.JWT_REFRESH_COOKIE, refresh, max_age=7 * 24 * 60 * 60, **cookie_kwargs)


def _delete_jwt_cookies(response):
    response.delete_cookie(settings.JWT_ACCESS_COOKIE, path="/", samesite=settings.JWT_COOKIE_SAMESITE)
    response.delete_cookie(settings.JWT_REFRESH_COOKIE, path="/", samesite=settings.JWT_COOKIE_SAMESITE)
