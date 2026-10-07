from rest_framework import status, permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.usuarios.models import Usuario
from apps.usuarios.permissions import EsAdministrador
from apps.usuarios.serializers import (
    CustomTokenObtainPairSerializer,
    UsuarioMeSerializer,
    UsuarioSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
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