from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador
from apps.reportes.models import Reporte
from apps.reportes.serializers import ReporteSerializer
from apps.reportes.services import generar_reporte


class ReporteViewSet(viewsets.ModelViewSet):
    """
    RF-28: el Administrador genera informes.
    RF-29: el Administrador descarga el informe. El Operador también puede verlos.
    Los reportes no se editan: se regeneran.
    """
    queryset = Reporte.objects.select_related("cultivo", "generado_por").all()
    serializer_class = ReporteSerializer

    # GET + POST + DELETE. Bloquea PUT y PATCH (no se editan reportes).
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_permissions(self):
        # Admin: crear, borrar, regenerar
        if self.action in ["create", "destroy", "regenerar"]:
            return [EsAdministrador()]
        # Ambos: ver y descargar
        return [EsAdministradorOOperador()]

    def perform_create(self, serializer):
        reporte = serializer.save(generado_por=self.request.user)
        generar_reporte(reporte)

    @action(detail=True, methods=["post"], url_path="regenerar")
    def regenerar(self, request, pk=None):
        """Regenera un reporte existente. Solo admin."""
        reporte = self.get_object()
        generar_reporte(reporte)
        return Response(self.get_serializer(reporte).data, status=status.HTTP_200_OK)