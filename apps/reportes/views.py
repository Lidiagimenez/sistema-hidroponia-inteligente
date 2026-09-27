from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador
from apps.reportes.models import Reporte
from apps.reportes.serializers import ReporteSerializer
from apps.reportes.services import generar_reporte


class ReporteViewSet(viewsets.ModelViewSet):
    queryset = Reporte.objects.select_related("cultivo", "generado_por").all()
    serializer_class = ReporteSerializer

    # Permisos según la acción: crear/borrar solo admin, el resto ambos roles
    def get_permissions(self):
        if self.action in ["create", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    # Al crear un reporte, se dispara la generación automáticamente
    def perform_create(self, serializer):
        reporte = serializer.save(generado_por=self.request.user)
        generar_reporte(reporte)

    # Endpoint extra: POST /api/reportes/{id}/regenerar/
    @action(detail=True, methods=["post"], url_path="regenerar")
    def regenerar(self, request, pk=None):
        reporte = self.get_object()
        generar_reporte(reporte)
        return Response(self.get_serializer(reporte).data, status=status.HTTP_200_OK)
