from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.dispositivos.models import Dispositivo
from apps.dispositivos.serializers import DispositivoSerializer
from apps.usuarios.permissions import EsAdministrador, EsAdministradorOOperador


class DispositivoViewSet(viewsets.ModelViewSet):
    queryset = Dispositivo.objects.all().order_by("pk")
    serializer_class = DispositivoSerializer

    def get_permissions(self):
        # Admin: crear, editar, borrar, regenerar API key
        if self.action in [
            "create",
            "update",
            "partial_update",
            "destroy",
            "regenerar_api_key",
        ]:
            return [EsAdministrador()]
        # Ambos: listar, ver detalle, accionar (encender/apagar)
        return [EsAdministradorOOperador()]

    @action(detail=True, methods=["post"], url_path="regenerar-api-key")
    def regenerar_api_key(self, request, pk=None):
        """Genera una API key nueva. Se muestra UNA sola vez; la anterior deja de valer."""
        dispositivo = self.get_object()
        clave = dispositivo.generar_api_key()
        return Response({
            "dispositivo": dispositivo.id,
            "api_key": clave,
            "aviso": "Guardala ahora: no se puede volver a ver.",
        })

    @action(detail=True, methods=["post"], url_path="accionar")
    def accionar(self, request, pk=None):
        """
        Enciende o apaga un dispositivo (bomba, iluminación, etc.).
        Disponible para operador Y administrador (RF-32).
        """
        dispositivo = self.get_object()
        accion = request.data.get("accion")

        if accion not in ("encender", "apagar"):
            return Response(
                {"error": "accion debe ser 'encender' o 'apagar'"},
                status=400,
            )

        dispositivo.estado = "activo" if accion == "encender" else "inactivo"
        dispositivo.save()

        return Response(DispositivoSerializer(dispositivo).data)