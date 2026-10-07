from rest_framework import viewsets

from apps.intervenciones.models import Intervencion
from apps.intervenciones.serializers import IntervencionSerializer
from apps.usuarios.permissions import EsOperador, EsAdministradorOOperador


class IntervencionViewSet(viewsets.ModelViewSet):
    """
    RF-23: el Operador registra la intervención.
    RF-25: el Operador agrega/edita observaciones.
    RNF-10: se registra automáticamente quién (operador) y cuándo.
    El Administrador solo puede ver el historial.
    Nadie puede borrar ni reemplazar (PUT) una intervención.
    """
    queryset = Intervencion.objects.all().order_by("-fecha_hora")
    serializer_class = IntervencionSerializer

    # GET + POST + PATCH. Bloquea PUT y DELETE para todos.
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self):
        # Solo el operador crea y edita (PATCH)
        if self.action in ["create", "partial_update"]:
            return [EsOperador()]
        # Ambos roles leen
        return [EsAdministradorOOperador()]