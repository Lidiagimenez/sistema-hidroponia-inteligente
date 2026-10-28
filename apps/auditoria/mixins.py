from apps.auditoria.models import RegistroAuditoria
from apps.auditoria.services import registrar_auditoria


class AuditableSerializerMixin:
    """
    Mixin para ViewSets de DRF: registra CREAR / EDITAR / ELIMINAR en
    RegistroAuditoria con el usuario, la IP y un resumen de los cambios.

    REGLA FUNDAMENTAL: todos los hooks delegan en super() ANTES de auditar,
    para no alterar la lógica que ya existía (borrado lógico de
    sensores/dispositivos/usuarios, serializer.save(usuario=...), checks de
    permiso en perform_destroy, etc.).

    Configuración por ViewSet:
        auditar_entidad = "Cultivo"   # nombre visible del módulo

    Si el ViewSet sobrescribe un perform_* (como SensorViewSet.perform_destroy)
    o tiene @action custom, llama al final de esa lógica:
        self._registrar_accion(RegistroAuditoria.Accion.ELIMINAR, instance, detalles={...})

    Las llamadas sin usuario autenticado (ingesta del ESP32, etc.) se ignoran.
    """

    auditar_entidad = ""

    # ------------------------------------------------------------------
    # Hooks estándar de DRF (para ViewSets SIN perform_* propios)
    # ------------------------------------------------------------------
    def perform_create(self, serializer):
        super().perform_create(serializer)
        self._registrar_accion(RegistroAuditoria.Accion.CREAR, serializer.instance)

    def perform_update(self, serializer):
        campos = sorted((serializer.validated_data or {}).keys())
        super().perform_update(serializer)
        self._registrar_accion(
            RegistroAuditoria.Accion.EDITAR,
            serializer.instance,
            detalles={"campos_modificados": campos} if campos else {},
        )

    def perform_destroy(self, instance):
        objeto_id = instance.pk  # se captura antes: un delete() real deja el pk en None
        super().perform_destroy(instance)
        borrar_logico = hasattr(instance, "is_active") and instance.is_active is False
        detalles = (
            {"modo": "desactivacion", "nota": "No se borra: queda desactivado para conservar el historial."}
            if borrar_logico
            else {"modo": "eliminacion", "nota": "El registro se borró de la base de datos."}
        )
        self._registrar_accion(
            RegistroAuditoria.Accion.ELIMINAR,
            instance,
            detalles=detalles,
            objeto_id=objeto_id,
        )

    # ------------------------------------------------------------------
    # API pública para ViewSets con perform_* / @action propios
    # ------------------------------------------------------------------
    def _registrar_accion(self, accion, instance=None, detalles=None, objeto_id=None):
        """
        Registra una acción sobre esta vista. Los ViewSets que definen su
        propio perform_create/perform_destroy la llaman explícitamente al final
        de su override (así no se pisa ninguna lógica previa).
        """
        if not self.auditar_entidad:
            return

        usuario = getattr(self.request, "user", None)
        if not getattr(usuario, "is_authenticated", False):
            return  # ingesta IoT u otras llamadas sin usuario: no se auditan acá

        if objeto_id is None and instance is not None:
            objeto_id = instance.pk

        detalles = dict(detalles or {})
        resumen = str(instance) if instance is not None else ""
        if resumen:
            detalles.setdefault("objeto", resumen)

        registrar_auditoria(
            self.request,
            accion,
            self.auditar_entidad,
            objeto_id=objeto_id,
            detalles=detalles,
        )