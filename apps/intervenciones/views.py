from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q

from apps.auditoria.mixins import AuditableSerializerMixin
from apps.auditoria.models import RegistroAuditoria
from apps.intervenciones.models import Intervencion
from apps.intervenciones.serializers import IntervencionSerializer
from apps.usuarios.permissions import EsAdministradorOOperador


class IntervencionViewSet(AuditableSerializerMixin, viewsets.ModelViewSet):
    auditar_entidad = "Intervención"
    """
    RF-23: registro de intervenciones.
    Ambos roles pueden crear/editar (admin también tiene que poder).
    RNF-10: se registra automáticamente quién y cuándo.
    Solo un administrador puede borrar; nadie puede reemplazar con PUT.
    """
    queryset = (
        Intervencion.objects
        .select_related("alerta", "cultivo", "ciclo", "ciclo__cultivo", "operador")
        .all()
        .order_by("-fecha_hora")
    )
    serializer_class = IntervencionSerializer

    # GET + POST + PATCH + DELETE. Bloquea PUT para evitar reemplazos completos.
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    # Todos los que están autenticados pueden crear/editar
    permission_classes = [EsAdministradorOOperador]

    def get_queryset(self):
        qs = super().get_queryset()
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
        user = self.request.user
        if not (getattr(user, "is_superuser", False) or user.rol == user.Rol.ADMINISTRADOR):
            raise PermissionDenied("Un operador no puede eliminar intervenciones.")
        objeto_id = instance.pk  # delete() real: el pk desaparece
        instance.delete()
        self._registrar_accion(
            RegistroAuditoria.Accion.ELIMINAR,
            None,
            detalles={"modo": "eliminacion", "nota": "El registro se borró de la base de datos."},
            objeto_id=objeto_id,
        )
