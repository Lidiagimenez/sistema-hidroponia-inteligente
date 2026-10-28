import django_filters

from apps.auditoria.models import RegistroAuditoria


class AuditoriaFilterSet(django_filters.FilterSet):
    fecha_desde = django_filters.DateFilter(field_name="fecha_hora", lookup_expr="date__gte")
    fecha_hasta = django_filters.DateFilter(field_name="fecha_hora", lookup_expr="date__lte")

    # Permite buscar por nombre de usuario (string) en vez de solo por ID numérico.
    # El frontend usa este campo cuando el usuario tipea en el buscador.
    usuario_nombre = django_filters.CharFilter(
        field_name="usuario__username",
        lookup_expr="icontains",
        label="Nombre de usuario (parcial)",
    )

    # Búsqueda parcial por módulo/entidad (ej: "Cultivo", "Sensor").
    entidad_nombre = django_filters.CharFilter(
        field_name="entidad",
        lookup_expr="icontains",
        label="Módulo (parcial)",
    )

    class Meta:
        model = RegistroAuditoria
        fields = ["usuario", "accion", "entidad", "usuario_nombre", "entidad_nombre"]