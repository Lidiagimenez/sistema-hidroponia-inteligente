from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.auditoria.mixins import AuditableSerializerMixin
from apps.auditoria.models import RegistroAuditoria
from apps.dispositivos.models import Dispositivo
from apps.dispositivos.serializers import DispositivoSerializer
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class DispositivoViewSet(AuditableSerializerMixin, viewsets.ModelViewSet):
    auditar_entidad = "Dispositivo"
    queryset = Dispositivo.objects.all().order_by("-pk")
    serializer_class = DispositivoSerializer

    def get_permissions(self):
        if self.action in [
            "create", "update", "partial_update", "destroy",
            "regenerar_api_key", "activar", "desactivar",
        ]:
            return [EsAdministrador()]
        return [EsAdministradorOOperador()]

    def get_queryset(self):
        qs = super().get_queryset()
        incluir_inactivos = self.request.query_params.get("incluir_inactivos") in ("1", "true", "True")
        if self.action == "list" and not incluir_inactivos:
            qs = qs.filter(is_active=True)
        return qs

    def perform_destroy(self, instance):
        # 🔥 BORRADO LÓGICO: Se oculta de la vista pero queda en la BD
        instance.is_active = False
        if instance.estado == Dispositivo.Estado.ACTIVO:
            instance.estado = Dispositivo.Estado.INACTIVO
        instance.save(update_fields=["is_active", "estado"])
        
        self._registrar_accion(
            RegistroAuditoria.Accion.ELIMINAR,
            instance,
            detalles={"modo": "desactivacion", "nota": "No se borra: queda desactivado para conservar el historial."},
        )

    @action(detail=True, methods=["post"])
    def desactivar(self, request, pk=None):
        dispositivo = self.get_object()
        dispositivo.is_active = False
        dispositivo.estado = Dispositivo.Estado.INACTIVO
        dispositivo.save(update_fields=["is_active", "estado"])
        self._registrar_accion(
            RegistroAuditoria.Accion.EDITAR,
            dispositivo,
            detalles={"modo": "desactivar", "campos_modificados": ["is_active", "estado"]},
        )
        return Response(self.get_serializer(dispositivo).data)

    @action(detail=True, methods=["post"])
    def activar(self, request, pk=None):
        dispositivo = self.get_object()
        dispositivo.is_active = True
        if dispositivo.estado == Dispositivo.Estado.INACTIVO:
            dispositivo.estado = Dispositivo.Estado.ACTIVO
        dispositivo.save(update_fields=["is_active", "estado"])
        self._registrar_accion(
            RegistroAuditoria.Accion.EDITAR,
            dispositivo,
            detalles={"modo": "activar", "campos_modificados": ["is_active", "estado"]},
        )
        return Response(self.get_serializer(dispositivo).data)

    @action(detail=True, methods=["post"], url_path="regenerar-api-key")
    def regenerar_api_key(self, request, pk=None):
        dispositivo = self.get_object()
        clave = dispositivo.generar_api_key()
        self._registrar_accion(
            RegistroAuditoria.Accion.EDITAR,
            dispositivo,
            detalles={"modo": "regenerar_api_key", "nota": "La API key anterior dejó de valer."},
        )
        return Response({
            "dispositivo": dispositivo.id,
            "api_key": clave,
            "aviso": "Guardala ahora: no se puede volver a ver.",
        })

    @action(detail=True, methods=["post"], url_path="accionar")
    def accionar(self, request, pk=None):
        dispositivo = self.get_object()
        accion = request.data.get("accion")

        if accion not in ("encender", "apagar"):
            return Response({"error": "accion debe ser 'encender' o 'apagar'"}, status=400)

        dispositivo.estado = "activo" if accion == "encender" else "inactivo"
        dispositivo.save()
        self._registrar_accion(
            RegistroAuditoria.Accion.EDITAR,
            dispositivo,
            detalles={"modo": "accionar", "acciones_ejecutadas": accion, "campos_modificados": ["estado"]},
        )
        return Response(DispositivoSerializer(dispositivo).data)