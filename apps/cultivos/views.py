from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend

from apps.cultivos.models import Cultivo, CicloProduccion
from apps.cultivos.serializers import CultivoSerializer, CicloProduccionSerializer
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class CultivoViewSet(viewsets.ModelViewSet):
    queryset = Cultivo.objects.all().order_by("pk")
    serializer_class = CultivoSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class CicloProduccionViewSet(viewsets.ModelViewSet):
    queryset = CicloProduccion.objects.all().order_by("pk")
    serializer_class = CicloProduccionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["cultivo", "estado"]

    def get_permissions(self):
        # Admin: todo. Operador: ver + editar (cambiar estado, fecha, finalizar).
        # Solo Admin puede crear o eliminar ciclos.
        if self.action in ["create", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]