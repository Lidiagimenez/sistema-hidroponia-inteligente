from datetime import datetime

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

# Imports necesarios para manejar la fecha que viene del ESP32
from django.http import QueryDict
from django.utils.datastructures import MultiValueDict
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.auditoria.mixins import AuditableSerializerMixin
from apps.auditoria.models import RegistroAuditoria
from apps.monitoreo.models import TipoSensor, Sensor, RangoOperacion, Medicion, Imagen, Dispositivo
from apps.monitoreo.serializers import (
    TipoSensorSerializer, SensorSerializer, RangoOperacionSerializer, MedicionSerializer, ImagenSerializer,
)
from apps.dispositivos.authentication import (
    DispositivoAPIKeyAuthentication, DispositivoAutenticado, EsDispositivo,
)
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador
from apps.common.throttles import ApiKeyScopedRateThrottle

# Importamos la autenticación de usuarios para que el Admin siga entrando
from apps.usuarios.authentication import CookieJWTAuthentication


class TipoSensorViewSet(AuditableSerializerMixin, viewsets.ModelViewSet):
    auditar_entidad = "Tipo de sensor"
    queryset = TipoSensor.objects.all().order_by("pk")
    serializer_class = TipoSensorSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]


class SensorViewSet(AuditableSerializerMixin, viewsets.ModelViewSet):
    auditar_entidad = "Sensor"
    queryset = (
        Sensor.objects
        .select_related("dispositivo", "tipo_sensor")
        .prefetch_related("cultivos")
        .order_by("pk")
    )
    serializer_class = SensorSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["dispositivo", "tipo_sensor", "cultivos", "is_active"]

    def get_permissions(self):
        if self.action in [
            "create", "update", "partial_update", "destroy",
            "activar", "desactivar",
        ]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    def get_queryset(self):
        qs = super().get_queryset()

        # Filtro por cultivo (M2M). Aceptamos /sensores/?cultivo=<id>.
        cultivo_id = self.request.query_params.get("cultivo")
        if cultivo_id:
            qs = qs.filter(cultivos__pk=cultivo_id).distinct()

        # Por defecto los listados ocultan los sensores desactivados.
        incluir_inactivos = self.request.query_params.get("incluir_inactivos") in ("1", "true", "True")
        if self.action == "list" and not incluir_inactivos:
            qs = qs.filter(is_active=True)

        return qs

    def perform_destroy(self, instance):
        # Borrado lógico: conservamos el historial de mediciones.
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        # La auditoría lo marca como "eliminar (desactivación)".
        self._registrar_accion(
            RegistroAuditoria.Accion.ELIMINAR,
            instance,
            detalles={"modo": "desactivacion", "nota": "No se borra: queda desactivado para conservar el historial."},
        )

    @action(detail=True, methods=["post"])
    def desactivar(self, request, pk=None):
        sensor = self.get_object()
        sensor.is_active = False
        sensor.save(update_fields=["is_active"])
        self._registrar_accion(
            RegistroAuditoria.Accion.EDITAR,
            sensor,
            detalles={"modo": "desactivar", "campos_modificados": ["is_active"]},
        )
        return Response(self.get_serializer(sensor).data)

    @action(detail=True, methods=["post"])
    def activar(self, request, pk=None):
        sensor = self.get_object()
        sensor.is_active = True
        sensor.save(update_fields=["is_active"])
        self._registrar_accion(
            RegistroAuditoria.Accion.EDITAR,
            sensor,
            detalles={"modo": "activar", "campos_modificados": ["is_active"]},
        )
        return Response(self.get_serializer(sensor).data)


# apps/monitoreo/views.py

class RangoOperacionViewSet(AuditableSerializerMixin, viewsets.ModelViewSet):
    auditar_entidad = "Rango de operación"
    serializer_class = RangoOperacionSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["sensor", "is_active"]

    def get_queryset(self):
        # 🔥 FILTRAMOS SOLO LOS ACTIVOS (Para no ver los eliminados)
        qs = RangoOperacion.objects.filter(is_active=True).order_by("pk")
        return qs

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    # 🔥 BORRADO LÓGICO
    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        self._registrar_accion(
            RegistroAuditoria.Accion.ELIMINAR,
            instance,
            detalles={"modo": "desactivacion", "nota": "El rango de operación fue desactivado."},
        )


class MedicionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Medicion.objects.all().order_by("-fecha_hora")
    serializer_class = MedicionSerializer
    permission_classes = [EsAdministradorOOperador]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["sensor", "estado_lectura"]


class IngestaMedicionView(APIView):
    authentication_classes = [DispositivoAPIKeyAuthentication]
    permission_classes = [EsDispositivo]
    throttle_classes = [ApiKeyScopedRateThrottle]
    throttle_scope = "iot_ingesta"

    def post(self, request):
        dispositivo = request.auth

        # 1. Validar el sensor
        try:
            sensor = Sensor.objects.select_related("dispositivo").get(pk=request.data.get("sensor"))
        except (Sensor.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "Sensor inexistente."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if sensor.dispositivo_id != dispositivo.id:
            return Response(
                {"detail": "Sensor inexistente o no pertenece a este dispositivo."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not getattr(dispositivo, "is_active", True) or getattr(dispositivo, "estado") == Dispositivo.Estado.INACTIVO or getattr(dispositivo, "estado") == Dispositivo.Estado.MANTENIMIENTO:
            return Response({"detail": "Dispositivo inactivo."}, status=status.HTTP_403_FORBIDDEN)
        if not getattr(sensor, "is_active", True):
            return Response({"detail": "Sensor inactivo."}, status=status.HTTP_403_FORBIDDEN)

        if not dispositivo.is_active or not dispositivo.esta_activo or dispositivo.estado == Dispositivo.Estado.INACTIVO:
            return Response({"detail": "Dispositivo inactivo."}, status=status.HTTP_403_FORBIDDEN)
        if not sensor.is_active:
            return Response({"detail": "Sensor inactivo."}, status=status.HTTP_403_FORBIDDEN)
        
        # 2. Validar el valor
        try:
            valor = float(request.data.get("valor"))
        except (TypeError, ValueError):
            return Response({"valor": "Debe ser un número."}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Lógica de Fecha (Store and Forward)
        fecha_str = request.data.get("fecha_hora")
        fecha_dt = parse_datetime(fecha_str) if fecha_str else timezone.now()
        
        if not fecha_dt:
            fecha_dt = timezone.now()

        # 4. Guardar en base de datos (EVITANDO DUPLICADOS DE FORMA SEGURA)
        medicion = Medicion.objects.filter(sensor=sensor, fecha_hora=fecha_dt).first()
        
        if medicion:
            created = False
        else:
            medicion = Medicion.objects.create(
                sensor=sensor,
                fecha_hora=fecha_dt,
                valor=valor
            )
            created = True
        
        if not created:
            print(f"⚠️ Dato duplicado evitado: Sensor {sensor.id} - Fecha {fecha_dt}")
            
        medicion.refresh_from_db()  
        
        return Response(MedicionSerializer(medicion).data, status=status.HTTP_201_CREATED)


def _parse_fecha_hora(valor):
    """
    Normaliza la fecha que manda el ESP32.
    Acepta ISO-8601 (con o sin zona horaria) o epoch en segundos.
    Devuelve None si no se puede interpretar.
    """
    if valor in (None, ""):
        return None

    texto = str(valor).strip()

    # Epoch en segundos: "1730000000"
    if texto.isdigit():
        try:
            return datetime.fromtimestamp(
                int(texto), tz=timezone.get_current_timezone()
            )
        except (OverflowError, OSError, ValueError):
            return None

    fecha = parse_datetime(texto)
    if fecha is None:
        return None
    if timezone.is_naive(fecha):
        fecha = timezone.make_aware(fecha, timezone.get_current_timezone())
    return fecha


class ImagenViewSet(viewsets.ModelViewSet):
    # ESP32 -> X-API-Key | Admin -> cookie/header JWT
    authentication_classes = [DispositivoAPIKeyAuthentication, CookieJWTAuthentication]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    queryset = Imagen.objects.select_related("cultivo").order_by("-fecha_hora")
    serializer_class = ImagenSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["cultivo", "fecha_hora"]

    # UserRateThrottle llama request.user.pk y DispositivoAutenticado no es un
    # Usuario: usamos el throttle por API key (con fallback a usuario).
    throttle_classes = [ApiKeyScopedRateThrottle]
    throttle_scope = "iot_imagenes"

    def get_permissions(self):
        if self.action == "create":
            # El | de DRF opera a nivel de CLASES (OperandHolder); hay que
            # instanciar la combinación: (EsDispositivo | EsAdministrador)().
            # Se devuelven instancias porque, al sobrescribir get_permissions(),
            # DRF ya no instancia las clases por nosotros.
            return [(EsDispositivo | EsAdministrador)()]
        if self.action in ["update", "partial_update", "destroy"]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    def create(self, request, *args, **kwargs):
        if not isinstance(request.data, (dict, QueryDict)):
            return Response(
                {"detail": "Se esperaba multipart/form-data o JSON."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # OJO: dict(QueryDict) y QueryDict.copy() son trampa:
        #  - dict(qd) lee el storage interno del MultiValueDict (¡listas!)
        #  - qd.copy() hace deepcopy y explota con TemporaryUploadedFile.
        # Copia superficial que conserva valores por clave:
        if isinstance(request.data, MultiValueDict):
            data = {clave: valores[-1] for clave, valores in request.data.lists()}
        else:
            data = dict(request.data)

        # 1) Aceptar el nombre de campo que use el firmware.
        if not data.get("archivo"):
            for alias in ("foto", "imagen", "file", "image"):
                if data.get(alias):
                    data["archivo"] = data[alias]
                    break

        # 2) Si sube un dispositivo y no manda cultivo, usar el del dispositivo.
        if (
            isinstance(request.user, DispositivoAutenticado)
            and not data.get("cultivo")
        ):
            data["cultivo"] = request.user.dispositivo.cultivo_id

        # 3) Normalizar la fecha (ISO-8601 o epoch) antes de que valide el serializer.
        fecha_dt = _parse_fecha_hora(data.get("fecha_hora"))
        if fecha_dt is not None:
            data["fecha_hora"] = fecha_dt.isoformat()

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)