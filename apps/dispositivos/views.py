from rest_framework import viewsets, permissions

from apps.dispositivos.models import Dispositivo
from apps.dispositivos.serializers import DispositivoSerializer
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class DispositivoViewSet(viewsets.ModelViewSet):
    queryset = Dispositivo.objects.all()
    serializer_class = DispositivoSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]
