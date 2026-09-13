from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend

from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion, Imagen
from apps.monitoreo.serializers import (
    TipoSensorSerializer, SensorSerializer, RangoOperacionSerializer, MedicionSerializer, ImagenSerializer,
)
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class TipoSensorViewSet(viewsets.ModelViewSet):
    queryset = TipoSensor.objects.all()
    serializer_class = TipoSensorSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]


class SensorViewSet(viewsets.ModelViewSet):
    queryset = Sensor.objects.all()
    serializer_class = SensorSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]


class RangoOperacionViewSet(viewsets.ModelViewSet):
    queryset = RangoOperacion.objects.all()
    serializer_class = RangoOperacionSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]


class MedicionViewSet(viewsets.ModelViewSet):
    # El ESP32 hace POST acá directamente (autenticado con su propio token/credencial)
    queryset = Medicion.objects.all().order_by("-fecha_hora")
    serializer_class = MedicionSerializer
    permission_classes = [EsAdministradorOOperador]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["sensor", "estado_lectura"]


class ImagenViewSet(viewsets.ModelViewSet):
    # RF-35: paginado y filtrable por fecha
    queryset = Imagen.objects.all().order_by("-fecha_hora")
    serializer_class = ImagenSerializer
    permission_classes = [EsAdministradorOOperador]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["cultivo", "fecha_hora"]