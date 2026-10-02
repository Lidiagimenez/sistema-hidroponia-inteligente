"""
Management command: entrena los modelos de IA (Isolation Forest)
para cada tipo de sensor que tenga suficientes datos.

Uso:
    python manage.py entrenar_modelos
    python manage.py entrenar_modelos --tipo-sensor 1
    python manage.py entrenar_modelos --ventana-dias 60
    python manage.py entrenar_modelos --evaluar-recientes

Qué hace:
  1. Recorre los tipos de sensor (o solo el que le pases con --tipo-sensor).
  2. Entrena un Isolation Forest por cada uno usando las mediciones
     de los últimos N días (default: 30).
  3. Guarda el modelo entrenado en `ml_models/iforest_tipo_sensor_<id>.joblib`.
  4. Opcionalmente evalúa las mediciones recientes con --evaluar-recientes.

Cuándo correrlo:
  - Una vez después de cargar datos históricos.
  - Periódicamente (por ejemplo, cada semana) para reentrenar con datos
    nuevos. El planificador lo puede llamar automáticamente.
"""

from django.core.management.base import BaseCommand

from apps.inteligencia import ia


class Command(BaseCommand):
    help = "Entrena los modelos de IA (Isolation Forest) por tipo de sensor."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tipo-sensor",
            type=int,
            default=None,
            help="ID del tipo de sensor a entrenar. Si no se pasa, entrena todos.",
        )
        parser.add_argument(
            "--ventana-dias",
            type=int,
            default=ia.VENTANA_ENTRENAMIENTO_DIAS,
            help=f"Días de histórico a usar (default: {ia.VENTANA_ENTRENAMIENTO_DIAS}).",
        )
        parser.add_argument(
            "--evaluar-recientes",
            action="store_true",
            help="Después de entrenar, evaluar las mediciones de la última hora.",
        )

    def handle(self, *args, **opts):
        self.stdout.write("=" * 60)
        self.stdout.write("ENTRENAMIENTO DE MODELOS DE IA")
        self.stdout.write("=" * 60)

        tipo_id = opts["tipo_sensor"]
        ventana = opts["ventana_dias"]

        if tipo_id:
            self._entrenar_uno(tipo_id, ventana)
        else:
            self._entrenar_todos(ventana)

        if opts["evaluar_recientes"]:
            self._evaluar_recientes()

        self.stdout.write("=" * 60)

    def _entrenar_uno(self, tipo_sensor_id, ventana_dias):
        from apps.monitoreo.models import TipoSensor

        try:
            tipo = TipoSensor.objects.get(pk=tipo_sensor_id)
        except TipoSensor.DoesNotExist:
            self.stderr.write(
                self.style.ERROR(f"TipoSensor {tipo_sensor_id} no existe.")
            )
            return

        self.stdout.write(
            f"\nEntrenando '{tipo.nombre}' (ID {tipo.id}) "
            f"con los últimos {ventana_dias} días..."
        )

        modelo = ia.entrenar_modelo(tipo.id, ventana_dias=ventana_dias)

        if modelo is None:
            self.stdout.write(self.style.WARNING(
                f"  ⚠ Sin datos suficientes. Mínimo requerido: "
                f"{ia.MIN_MUESTRAS_ENTRENAMIENTO} mediciones normales."
            ))
        else:
            ruta = ia._ruta_modelo(tipo.id)
            self.stdout.write(self.style.SUCCESS(
                f"  ✅ Modelo entrenado y guardado en {ruta.name}"
            ))

    def _entrenar_todos(self, ventana_dias):
        self.stdout.write(
            f"\nEntrenando todos los tipos de sensor "
            f"con los últimos {ventana_dias} días..."
        )

        resultado = ia.entrenar_todos_los_modelos()

        ok = sum(1 for v in resultado.values() if v == "ok")
        sin_datos = sum(1 for v in resultado.values() if v == "sin_datos")
        errores = sum(1 for v in resultado.values() if v == "error")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"  Entrenados OK:    {ok}"))
        self.stdout.write(self.style.WARNING(f"  Sin datos:        {sin_datos}"))
        if errores:
            self.stdout.write(self.style.ERROR(f"  Con error:        {errores}"))

    def _evaluar_recientes(self):
        self.stdout.write("\nEvaluando mediciones de la última hora...")
        creadas = ia.evaluar_mediciones_recientes(horas=1)
        self.stdout.write(self.style.SUCCESS(
            f"  Anomalías detectadas: {creadas}"
        ))