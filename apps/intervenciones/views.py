from rest_framework import viewsets

from apps.intervenciones.models import Intervencion
from apps.intervenciones.serializers import IntervencionSerializer
from apps.usuarios.permissions import EsAdministradorOOperador


class IntervencionViewSet(viewsets.ModelViewSet):
    """
    RF-23: registro de intervenciones.
    Ambos roles pueden crear/editar (admin también tiene que poder).
    RNF-10: se registra automáticamente quién y cuándo.
    Nadie puede borrar ni reemplazar (PUT) una intervención.
    """
    queryset = Intervencion.objects.all().order_by("-fecha_hora")
    serializer_class = IntervencionSerializer

    # GET + POST + PATCH. Bloquea PUT y DELETE para todos.
    http_method_names = ["get", "post", "patch", "head", "options"]

    # Todos los que están autenticados pueden crear/editar
    permission_classes = [EsAdministradorOOperador]