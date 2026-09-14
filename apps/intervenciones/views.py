from rest_framework import viewsets
from apps.intervenciones.models import Intervencion
from apps.intervenciones.serializers import IntervencionSerializer
from apps.usuarios.permissions import EsOperador, EsAdministradorOOperador


class IntervencionViewSet(viewsets.ModelViewSet):
    queryset = Intervencion.objects.all().order_by("-fecha_hora")
    serializer_class = IntervencionSerializer

    def get_permissions(self):
        if self.action == "create":
            return [EsOperador()]  # RF: quien registra la intervención es el Operador
        return [EsAdministradorOOperador()]