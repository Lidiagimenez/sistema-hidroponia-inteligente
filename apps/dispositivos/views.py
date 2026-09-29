from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.dispositivos.models import Dispositivo
from apps.dispositivos.serializers import DispositivoSerializer
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class DispositivoViewSet(viewsets.ModelViewSet):
    queryset = Dispositivo.objects.all().order_by("pk")
    serializer_class = DispositivoSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "regenerar_api_key"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    @action(detail=True, methods=["post"], url_path="regenerar-api-key")
    def regenerar_api_key(self, request, pk=None):
        """Genera una API key nueva. Se muestra UNA sola vez; la anterior deja de valer."""
        dispositivo = self.get_object()
        clave = dispositivo.generar_api_key()
        return Response({
            "dispositivo": dispositivo.id,
            "api_key": clave,
            "aviso": "Guardala ahora: no se puede volver a ver.",
        })
