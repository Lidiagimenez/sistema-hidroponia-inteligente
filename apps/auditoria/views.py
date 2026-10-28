from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.auditoria.filters import AuditoriaFilterSet
from apps.auditoria.models import RegistroAuditoria
from apps.auditoria.serializers import RegistroAuditoriaSerializer
from apps.usuarios.permissions import EsAdministrador


class RegistroAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/auditoria/          → lista paginada (50 por página)
    GET /api/auditoria/?usuario=&accion=&entidad=&fecha_desde=&fecha_hasta=
    GET /api/auditoria/resumen/  → KPIs para las tarjetas del frontend

    SÓLO LECTURA: a la auditoría nadie puede crearla, editarla ni borrarla.
    Solo Administrador (coherente con la sección "Administración" del sidebar).
    """
    queryset = (
        RegistroAuditoria.objects
        .select_related("usuario")
        .all()
        .order_by("-fecha_hora")
    )
    serializer_class = RegistroAuditoriaSerializer
    permission_classes = [EsAdministrador]
    filter_backends = [DjangoFilterBackend]
    filterset_class = AuditoriaFilterSet

    @action(detail=False, methods=["get"])
    def resumen(self, request):
        """
        KPIs de auditoría. Respeta los filtros de la query (así las tarjetas
        reflejan lo mismo que la tabla); sin filtros = totales globales.
        """
        qs = self.filter_queryset(self.get_queryset())

        por_accion = dict(
            qs.order_by()  # clave: sin esto, el Meta.ordering mete fecha_hora en el GROUP BY
            .values("accion")
            .annotate(cantidad=Count("id"))
            .values_list("accion", "cantidad")
        )

        return Response({
            "total": qs.count(),
            "creaciones": por_accion.get(RegistroAuditoria.Accion.CREAR, 0),
            "modificaciones": (
                por_accion.get(RegistroAuditoria.Accion.EDITAR, 0)
                + por_accion.get(RegistroAuditoria.Accion.ELIMINAR, 0)
            ),
            "inicios_sesion": por_accion.get(RegistroAuditoria.Accion.LOGIN, 0),
            "eliminaciones": por_accion.get(RegistroAuditoria.Accion.ELIMINAR, 0),
            "logins_fallidos": por_accion.get(RegistroAuditoria.Accion.LOGIN_FALLIDO, 0),
        })