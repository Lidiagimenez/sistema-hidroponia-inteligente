from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend

from apps.alertas.models import ParametroAlerta, Alerta
from apps.alertas.serializers import ParametroAlertaSerializer, AlertaSerializer
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class ParametroAlertaViewSet(viewsets.ModelViewSet):
    # RF-30: solo el Administrador configura
    queryset = ParametroAlerta.objects.all()
    serializer_class = ParametroAlertaSerializer
    permission_classes = [EsAdministrador]


class AlertaViewSet(viewsets.ReadOnlyModelViewSet):
    # RF-22: visualización, para ambos roles
    queryset = Alerta.objects.all().order_by("-fecha_hora_inicio")
    serializer_class = AlertaSerializer
    permission_classes = [EsAdministradorOOperador]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["estado", "severidad"]