from django.db.models import Q
from django.utils import timezone

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.alertas.models import Alerta, ParametroAlerta
from apps.alertas.serializers import AlertaSerializer, ParametroAlertaSerializer
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class ParametroAlertaViewSet(viewsets.ModelViewSet):
    # RF-30: solo el Administrador configura
    queryset = ParametroAlerta.objects.all().order_by("pk")
    serializer_class = ParametroAlertaSerializer
    permission_classes = [EsAdministrador]


class AlertaViewSet(viewsets.ModelViewSet):
    """
    RF-22: visualización para ambos roles.
    RF-24: ambos roles pueden marcar una alerta como resuelta (solo PATCH sobre 'estado').
    Las alertas son automáticas → nadie puede crearlas, editarlas por completo ni borrarlas.
    Filtro por cultivo: vía medición o vía evento.
    """
    queryset = Alerta.objects.all().order_by("-fecha_hora_inicio")
    serializer_class = AlertaSerializer
    permission_classes = [EsAdministradorOOperador]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["estado", "severidad"]

    # Solo GET y PATCH. Bloquea POST (create), PUT (update), DELETE (destroy).
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        """
        Filtra por cultivo. Una alerta se relaciona con un cultivo por:
          - su medición → sensor → dispositivo → cultivo
          - o por su evento → cultivo
        Como son caminos distintos, usamos Q para OR.
        """
        qs = super().get_queryset()
        cultivo_id = self.request.query_params.get("cultivo")
        if cultivo_id:
            qs = qs.filter(
                Q(medicion__sensor__dispositivo__cultivo_id=cultivo_id) |
                Q(evento__cultivo_id=cultivo_id)
            ).distinct()
        return qs

    def partial_update(self, request, *args, **kwargs):
        """Solo permite cambiar el campo 'estado' (marcar como resuelta)."""
        campos_no_permitidos = set(request.data.keys()) - {"estado"}
        if campos_no_permitidos:
            return Response(
                {
                    "error": "Solo se puede modificar el campo 'estado'.",
                    "campos_no_permitidos": list(campos_no_permitidos),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        alerta = self.get_object()
        nuevo_estado = request.data.get("estado")

        if nuevo_estado not in dict(Alerta.Estado.choices):
            return Response(
                {"estado": f"Debe ser uno de: {list(dict(Alerta.Estado.choices).keys())}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        alerta.estado = nuevo_estado
        # Si se marca como resuelta, seteamos la fecha de fin
        if nuevo_estado == Alerta.Estado.RESUELTA and not alerta.fecha_hora_fin:
            alerta.fecha_hora_fin = timezone.now()
        alerta.save()

        return Response(AlertaSerializer(alerta).data)