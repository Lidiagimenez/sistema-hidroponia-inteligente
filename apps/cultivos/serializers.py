from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.cultivos.models import Cultivo, CicloProduccion


# Estados válidos del ciclo
ESTADOS_CICLO = [
    ("germinacion", "Germinación"),
    ("plantula", "Plántula"),
    ("crecimiento", "Crecimiento vegetativo"),
    ("floracion", "Floración"),
    ("cosecha", "Cosecha"),
]

# Duración estimada por tipo de cultivo (días)
# Si el tipo no está en el diccionario, se usa DURACION_DEFAULT_DIAS.
DURACION_POR_TIPO = {
    "lechuga": 60,
    "lechuga francesa": 60,
    "albahaca": 45,
    "tomate": 90,
    "tomate cherry": 80,
    "frutilla": 120,
    "oregano": 30,
    "orégano": 30,
    "kale": 55,
    "espinaca": 50,
    "rucula": 35,
    "rúcula": 35,
}

DURACION_DEFAULT_DIAS = 60


def duracion_para_tipo(tipo_cultivo):
    """Devuelve la duración estimada según el tipo, o el default."""
    if not tipo_cultivo:
        return DURACION_DEFAULT_DIAS
    return DURACION_POR_TIPO.get(tipo_cultivo.lower().strip(), DURACION_DEFAULT_DIAS)


class CicloActivoSerializer(serializers.ModelSerializer):
    """Serializer reducido para incluir el ciclo activo dentro de Cultivo."""
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = CicloProduccion
        fields = (
            "id_ciclo",
            "fecha_inicio",
            "fecha_fin_estimada",
            "fecha_fin_real",
            "estado",
            "estado_display",
        )


class CultivoSerializer(serializers.ModelSerializer):
    ciclo_activo = serializers.SerializerMethodField()

    # Campos write-only: solo se usan al crear un cultivo nuevo.
    # Al crear, generan automáticamente el primer CicloProduccion.
    fecha_siembra = serializers.DateField(
        write_only=True,
        required=False,
        help_text="Fecha real en que se sembró. Puede ser pasada.",
    )
    estado_ciclo = serializers.ChoiceField(
        write_only=True,
        choices=ESTADOS_CICLO,
        required=False,
        default="germinacion",
    )
    duracion_ciclo_dias = serializers.IntegerField(
        write_only=True,
        required=False,
        min_value=1,
        max_value=365,
        help_text="Duración esperada del ciclo. Si no se envía, se calcula por tipo.",
    )

    class Meta:
        model = Cultivo
        fields = (
            "id_cultivo",
            "nombre",
            "tipo_cultivo",
            "fecha_creacion",
            "usuario",
            "ciclo_activo",
            "fecha_siembra",
            "estado_ciclo",
            "duracion_ciclo_dias",
            "is_active",
        )
        read_only_fields = ["usuario"]

    def get_ciclo_activo(self, obj):
        """
        Devuelve el ciclo activo (no finalizado) más reciente del cultivo.
        Si no hay ninguno, devuelve None.
        """
        ciclo = (
            obj.ciclos
            .exclude(estado="finalizado")
            .order_by("-fecha_inicio")
            .first()
        )
        if ciclo is None:
            return None
        return CicloActivoSerializer(ciclo).data

    def create(self, validated_data):
        """
        Al crear un cultivo, también se crea su primer ciclo de producción
        con los datos ingresados (fecha de siembra, estado, duración).
        """
        # Extraer los campos del ciclo
        fecha_siembra = validated_data.pop("fecha_siembra", None)
        estado_ciclo = validated_data.pop("estado_ciclo", "germinacion")
        duracion = validated_data.pop("duracion_ciclo_dias", None)

        # Si no se envió fecha_creacion, usar hoy
        if not validated_data.get("fecha_creacion"):
            validated_data["fecha_creacion"] = timezone.now().date()

        # Crear el cultivo
        cultivo = super().create(validated_data)

        # Determinar fecha de inicio del ciclo
        if fecha_siembra is None:
            fecha_siembra = cultivo.fecha_creacion

        # Determinar duración esperada
        if duracion is None:
            duracion = duracion_para_tipo(cultivo.tipo_cultivo)

        # Calcular fecha estimada de cosecha
        fecha_fin_estimada = fecha_siembra + timedelta(days=duracion)

        # Crear el ciclo
        CicloProduccion.objects.create(
            cultivo=cultivo,
            fecha_inicio=fecha_siembra,
            fecha_fin_estimada=fecha_fin_estimada,
            estado=estado_ciclo,
        )

        return cultivo


class CicloProduccionSerializer(serializers.ModelSerializer):
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = CicloProduccion
        fields = "__all__"