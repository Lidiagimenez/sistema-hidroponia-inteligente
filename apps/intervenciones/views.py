from rest_framework import viewsets
from django.db.models import Q
from apps.auditoria.mixins import AuditableSerializerMixin
from apps.auditoria.models import RegistroAuditoria
from apps.intervenciones.models import Intervencion
from apps.intervenciones.serializers import IntervencionSerializer
from apps.usuarios.permissions import EsAdministradorOOperador


class IntervencionViewSet(AuditableSerializerMixin, viewsets.ModelViewSet):
    auditar_entidad = "Intervención"
    queryset = (
        Intervencion.objects
        .select_related("alerta", "cultivo", "ciclo", "ciclo__cultivo", "sensor", "operador")
        .all()
        .order_by("-fecha_hora")
    )
    serializer_class = IntervencionSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    permission_classes = [EsAdministradorOOperador]

    def get_queryset(self):
        # Filtramos solo las activas (Soft Delete)
        qs = super().get_queryset().filter(is_active=True)
        
        cultivo = self.request.query_params.get("cultivo")
        tipo = self.request.query_params.get("tipo")
        fecha = self.request.query_params.get("fecha")
        fecha_desde = self.request.query_params.get("fecha_desde")
        fecha_hasta = self.request.query_params.get("fecha_hasta")

        if cultivo:
            qs = qs.filter(Q(cultivo_id=cultivo) | Q(ciclo__cultivo_id=cultivo))
        if tipo:
            qs = qs.filter(tipo=tipo)
        if fecha_desde:
            qs = qs.filter(fecha_hora__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha_hora__date__lte=fecha_hasta)
        if fecha:
            qs = qs.filter(fecha_hora__date=fecha)
        return qs

    def perform_destroy(self, instance):
        # 🔥 SOFT DELETE: Ambos roles pueden desactivar la intervención
        instance.is_active = False
        instance.save()
        
        self._registrar_accion(
            RegistroAuditoria.Accion.ELIMINAR,
            instance,
            detalles={"modo": "desactivacion", "nota": "El registro se desactivó de la base de datos."},
        )