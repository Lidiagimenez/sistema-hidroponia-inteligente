from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend

from apps.cultivos.models import Cultivo, CicloProduccion
from apps.cultivos.serializers import CultivoSerializer, CicloProduccionSerializer
from apps.auditoria.mixins import AuditableSerializerMixin
from apps.auditoria.models import RegistroAuditoria
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class CultivoViewSet(AuditableSerializerMixin, viewsets.ModelViewSet):
    auditar_entidad = "Cultivo"
    serializer_class = CultivoSerializer

    def get_queryset(self):
        # 🔥 CAMBIO 1: Solo trae los cultivos activos. 
        # Si querés ver los inactivos, usás ?incluir_inactivos=1
        if self.request.query_params.get('incluir_inactivos') == '1':
            return Cultivo.objects.all().order_by("pk")
        return Cultivo.objects.filter(is_active=True).order_by("pk")

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
        self._registrar_accion(RegistroAuditoria.Accion.CREAR, serializer.instance)

    # 🔥 CAMBIO 2: El borrado lógico
    def perform_destroy(self, instance):
        # En lugar de instance.delete(), solo lo desactivamos
        instance.is_active = False
        instance.save()
        # Registramos en auditoría como si fuera un borrado
        self._registrar_accion(RegistroAuditoria.Accion.ELIMINAR, instance)


class CicloProduccionViewSet(AuditableSerializerMixin, viewsets.ModelViewSet):
    auditar_entidad = "Ciclo de producción"
    queryset = CicloProduccion.objects.all().order_by("pk")
    serializer_class = CicloProduccionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["cultivo", "estado"]

    def get_permissions(self):
        if self.action in ["create", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]