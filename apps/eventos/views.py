from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend

from apps.eventos.models import Evento
from apps.eventos.serializers import EventoSerializer
from apps.usuarios.permissions import EsAdministradorOOperador


class EventoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Evento.objects.all().order_by("-fecha_hora")
    serializer_class = EventoSerializer
    permission_classes = [EsAdministradorOOperador]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["tipo_evento", "cultivo"]