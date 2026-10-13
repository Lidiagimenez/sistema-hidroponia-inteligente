from django.conf import settings
from rest_framework import status, permissions, viewsets
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

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


class UsuarioViewSet(viewsets.ModelViewSet):
    """
    Solo el administrador puede gestionar usuarios (RF-02).
    El operador no tiene acceso a nada de acá.
    """
    queryset = Usuario.objects.all().order_by("pk")
    serializer_class = UsuarioSerializer
    permission_classes = [EsAdministrador]


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
