from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion, Imagen
from apps.monitoreo.serializers import (
    TipoSensorSerializer, SensorSerializer, RangoOperacionSerializer, MedicionSerializer, ImagenSerializer,
)
from apps.dispositivos.authentication import DispositivoAPIKeyAuthentication, EsDispositivo
from apps.monitoreo.services import registrar_medicion
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class TipoSensorViewSet(viewsets.ModelViewSet):
    queryset = TipoSensor.objects.all().order_by("pk")
    serializer_class = TipoSensorSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]


class SensorViewSet(viewsets.ModelViewSet):
    queryset = Sensor.objects.all().order_by("pk")
    serializer_class = SensorSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]


class RangoOperacionViewSet(viewsets.ModelViewSet):
    queryset = RangoOperacion.objects.all().order_by("pk")
    serializer_class = RangoOperacionSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]


class MedicionViewSet(viewsets.ReadOnlyModelViewSet):
    # Las personas SOLO consultan mediciones. Las mediciones entran por
    # POST /api/ingesta/mediciones/ (dispositivo con API key), así nadie
    # puede editar ni borrar el historial de lecturas.
    queryset = Medicion.objects.all().order_by("-fecha_hora")
    serializer_class = MedicionSerializer
    permission_classes = [EsAdministradorOOperador]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["sensor", "estado_lectura"]


class IngestaMedicionView(APIView):
    """El ESP32 envía lecturas acá. Header: X-API-Key. Body: {"sensor": <id>, "valor": <float>}"""
    authentication_classes = [DispositivoAPIKeyAuthentication]
    permission_classes = [EsDispositivo]

    def post(self, request):
        dispositivo = request.auth
        try:
            sensor = Sensor.objects.get(pk=request.data.get("sensor"), dispositivo=dispositivo)
        except (Sensor.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "Sensor inexistente o no pertenece a este dispositivo."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            valor = float(request.data.get("valor"))
        except (TypeError, ValueError):
            return Response({"valor": "Debe ser un número."}, status=status.HTTP_400_BAD_REQUEST)

        medicion = registrar_medicion(sensor.id, valor)
        medicion.refresh_from_db()  # la señal actualiza estado_lectura
        return Response(MedicionSerializer(medicion).data, status=status.HTTP_201_CREATED)


class ImagenViewSet(viewsets.ModelViewSet):
    # RF-35: paginado y filtrable por fecha
    # Operador solo ve la galería. Admin puede crear/editar/borrar.
    queryset = Imagen.objects.all().order_by("-fecha_hora")
    serializer_class = ImagenSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["cultivo", "fecha_hora"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]