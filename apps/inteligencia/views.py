from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.cultivos.models import Cultivo, CicloProduccion
from apps.dispositivos.models import Dispositivo
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador
from apps.inteligencia.models import (
    ParametroImagen, AnalisisImagen, AvisoCrecimiento, Recomendacion,
)
from apps.inteligencia.serializers import (
    ParametroImagenSerializer, AnalisisImagenSerializer,
    AvisoCrecimientoSerializer, RecomendacionSerializer,
    SubirImagenSerializer,
)
from apps.inteligencia.services import procesar_analisis, traer_captura
from apps.inteligencia.recomendaciones import evaluar_recomendaciones


class ParametroImagenViewSet(viewsets.ModelViewSet):
    queryset = ParametroImagen.objects.select_related("cultivo").all()
    serializer_class = ParametroImagenSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]


class AnalisisImagenViewSet(viewsets.ModelViewSet):
    queryset = (
        AnalisisImagen.objects
        .select_related("cultivo", "ciclo", "dispositivo")
        .all()
    )
    serializer_class = AnalisisImagenSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ["create", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    def create(self, request, *args, **kwargs):
        ser = SubirImagenSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        cultivo = Cultivo.objects.get(pk=ser.validated_data["cultivo"])
        ciclo_id = ser.validated_data.get("ciclo")
        dispositivo_id = ser.validated_data.get("dispositivo")
        ciclo = CicloProduccion.objects.filter(pk=ciclo_id).first() if ciclo_id else None
        dispositivo = (
            Dispositivo.objects.filter(pk=dispositivo_id).first()
            if dispositivo_id else None
        )

        analisis = AnalisisImagen.objects.create(
            cultivo=cultivo,
            ciclo=ciclo,
            dispositivo=dispositivo,
            imagen=ser.validated_data["imagen"],
            fecha_hora=ser.validated_data.get("fecha_hora") or None,
            origen_captura=ser.validated_data.get("origen_captura", "manual"),
        )
        procesar_analisis(analisis)

        return Response(
            AnalisisImagenSerializer(analisis, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path=r"cultivo/(?P<cultivo_id>\d+)")
    def por_cultivo(self, request, cultivo_id=None):
        qs = self.get_queryset().filter(cultivo_id=cultivo_id)

        desde = request.query_params.get("desde")
        hasta = request.query_params.get("hasta")
        if desde:
            qs = qs.filter(fecha_hora__date__gte=desde)
        if hasta:
            qs = qs.filter(fecha_hora__date__lte=hasta)

        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                self.get_serializer(page, many=True).data
            )
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["post"], url_path="capturar-ahora")
    def capturar_ahora(self, request):
        """Dispara una captura manual contra un dispositivo."""
        dispositivo_id = request.data.get("dispositivo")
        if not dispositivo_id:
            return Response(
                {"detail": "Falta 'dispositivo'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dispositivo = Dispositivo.objects.filter(pk=dispositivo_id).first()
        if not dispositivo:
            return Response(
                {"detail": "Dispositivo no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        analisis = traer_captura(dispositivo, origen="manual")
        if not analisis:
            return Response(
                {"detail": "No se pudo obtener la captura."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            AnalisisImagenSerializer(analisis, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AvisoCrecimientoViewSet(viewsets.ModelViewSet):
    queryset = (
        AvisoCrecimiento.objects
        .select_related("cultivo", "analisis_origen")
        .all()
    )
    serializer_class = AvisoCrecimientoSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    @action(detail=True, methods=["post"])
    def resolver(self, request, pk=None):
        aviso = self.get_object()
        aviso.resuelto = True
        aviso.save(update_fields=["resuelto"])
        return Response(self.get_serializer(aviso).data)


class RecomendacionViewSet(viewsets.ModelViewSet):
    queryset = Recomendacion.objects.select_related("cultivo").all()
    serializer_class = RecomendacionSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    @action(detail=True, methods=["post"])
    def resolver(self, request, pk=None):
        rec = self.get_object()
        rec.resuelta = True
        rec.vigente = False
        rec.save(update_fields=["resuelta", "vigente"])
        return Response(self.get_serializer(rec).data)

    @action(detail=False, methods=["post"], url_path="evaluar")
    def evaluar(self, request):
        """Corre el motor de recomendaciones para un cultivo."""
        cultivo_id = request.data.get("cultivo")
        if not cultivo_id:
            return Response(
                {"detail": "Falta 'cultivo'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cultivo = Cultivo.objects.filter(pk=cultivo_id).first()
        if not cultivo:
            return Response(
                {"detail": "Cultivo no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        generadas = evaluar_recomendaciones(cultivo)
        return Response({
            "cultivo": cultivo.id,
            "generadas": len(generadas),
            "recomendaciones": RecomendacionSerializer(generadas, many=True).data,
        })