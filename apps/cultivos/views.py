from rest_framework import viewsets
from apps.cultivos.models import Cultivo, CicloProduccion
from apps.cultivos.serializers import CultivoSerializer, CicloProduccionSerializer
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class CultivoViewSet(viewsets.ModelViewSet):
    queryset = Cultivo.objects.all()
    serializer_class = CultivoSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class CicloProduccionViewSet(viewsets.ModelViewSet):
    queryset = CicloProduccion.objects.all()
    serializer_class = CicloProduccionSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]