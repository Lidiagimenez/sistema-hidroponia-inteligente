from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView

from apps.cultivos.models import Cultivo, CicloProduccion
from apps.dispositivos.models import Dispositivo
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador
from apps.usuarios.authentication import CookieJWTAuthentication
from apps.inteligencia.models import (
    ParametroImagen, AnalisisImagen, AvisoCrecimiento, Recomendacion, Anomalia,
)
from apps.inteligencia.serializers import (
    ParametroImagenSerializer, AnalisisImagenSerializer,
    AvisoCrecimientoSerializer, RecomendacionSerializer,
    AnomaliaSerializer, SubirImagenSerializer,
)
from apps.inteligencia.services import procesar_analisis, traer_captura
from apps.inteligencia.recomendaciones import evaluar_recomendaciones
from apps.inteligencia import prediccion

from django_filters.rest_framework import DjangoFilterBackend

class ParametroImagenViewSet(viewsets.ModelViewSet):
    queryset = ParametroImagen.objects.select_related("cultivo").order_by("pk")
    serializer_class = ParametroImagenSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]


class AnalisisImagenViewSet(viewsets.ModelViewSet):
    queryset = (
        AnalisisImagen.objects
        .select_related("cultivo", "ciclo", "dispositivo")
        .order_by("pk")
    )
    serializer_class = AnalisisImagenSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["cultivo", "origen_captura", "etapa_fenologica"]

    def get_permissions(self):
        # Admin: crear, borrar, capturar manualmente, editar
        if self.action in ["create", "update", "partial_update", "destroy", "capturar_ahora"]:
            return [EsAdministrador()]
        # Ambos: ver galería e imágenes
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
        """Dispara una captura manual contra un dispositivo. Solo admin."""
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
        .order_by("pk")
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
    queryset = Recomendacion.objects.select_related("cultivo").order_by("pk")
    serializer_class = RecomendacionSerializer

    def get_permissions(self):
        # Admin: crear/editar/borrar + correr el motor
        if self.action in ["create", "update", "partial_update", "destroy", "evaluar"]:
            return [EsAdministrador()]
        # Ambos: ver y resolver
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
        """Corre el motor de recomendaciones para un cultivo. Solo admin."""
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
            "cultivo": cultivo.pk,
            "generadas": len(generadas),
            "recomendaciones": RecomendacionSerializer(generadas, many=True).data,
        })


class AnomaliaViewSet(viewsets.ModelViewSet):
    """
    Anomalías detectadas por IA. Solo lectura + acciones de marcar estado.
    Admin puede borrar. Ambos pueden revisar/descartar.
    """
    queryset = (
        Anomalia.objects
        .select_related("cultivo", "sensor", "sensor__tipo_sensor", "medicion")
        .order_by("-fecha_deteccion")
    )
    serializer_class = AnomaliaSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    @action(detail=True, methods=["post"])
    def revisar(self, request, pk=None):
        anomalia = self.get_object()
        anomalia.estado = Anomalia.Estado.REVISADA
        anomalia.save(update_fields=["estado"])
        return Response(self.get_serializer(anomalia).data)

    @action(detail=True, methods=["post"])
    def descartar(self, request, pk=None):
        anomalia = self.get_object()
        anomalia.estado = Anomalia.Estado.DESCARTADA
        anomalia.save(update_fields=["estado"])
        return Response(self.get_serializer(anomalia).data)

    @action(detail=False, methods=["get"], url_path=r"cultivo/(?P<cultivo_id>\d+)")
    def por_cultivo(self, request, cultivo_id=None):
        qs = self.get_queryset().filter(cultivo_id=cultivo_id)

        estado = request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)

        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                self.get_serializer(page, many=True).data
            )
        return Response(self.get_serializer(qs, many=True).data)


class PrediccionAPIView(APIView):
    """
    Endpoint de predicción con Random Forest.
    GET /api/predicciones/?cultivo=<id> o /api/predicciones/?sensor=<id>
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [EsAdministradorOOperador]

    def get(self, request):
        cultivo_id = request.query_params.get("cultivo")
        sensor_id = request.query_params.get("sensor")
        tipo_sensor_id = request.query_params.get("tipo_sensor")

        if not cultivo_id and not sensor_id and not tipo_sensor_id:
            return Response(
                {"detail": "Debe proporcionar 'cultivo', 'sensor' o 'tipo_sensor'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Si es por cultivo, devolver predicciones para todos los sensores
        if cultivo_id:
            resultados = prediccion.predecir_para_cultivo(cultivo_id)
            if not resultados:
                return Response(
                    {"detail": "No hay datos suficientes para predecir o no hay sensores asociados."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            # Si hay múltiples, devolver lista; si hay uno, también puede devolver estructura simple
            if len(resultados) == 1:
                return Response(resultados[0])
            return Response(resultados)

        # Si es por sensor
        if sensor_id:
            resultado = prediccion.predecir_siguiente(sensor_id=sensor_id)
            if not resultado:
                return Response(
                    {"detail": "No hay datos suficientes para predecir."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(resultado)

        # Si es por tipo de sensor
        if tipo_sensor_id:
            resultado = prediccion.predecir_siguiente(tipo_sensor_id=tipo_sensor_id)
            if not resultado:
                return Response(
                    {"detail": "No hay datos suficientes para predecir."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(resultado)

        return Response(
            {"detail": "Error inesperado."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )