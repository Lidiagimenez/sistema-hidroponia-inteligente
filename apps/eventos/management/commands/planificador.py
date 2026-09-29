"""
Planificador simple de tareas periódicas (sin Celery ni cron).

Uso:
    python manage.py planificador          # queda corriendo (Ctrl+C para parar)
    python manage.py planificador --once   # corre todas las tareas una vez y termina
"""
import time
import traceback

from django.core.management import call_command
from django.core.management.base import BaseCommand

# (comando, cada_cuántos_segundos, argumentos)
TAREAS = [
    ("chequear_eventos", 5 * 60, []),
    ("poll_camaras", 30 * 60, []),
    ("evaluar_recomendaciones", 60 * 60, []),
    ("sync_camaras", 24 * 60 * 60, []),
    ("limpiar_imagenes_antiguas", 24 * 60 * 60, []),
]


class Command(BaseCommand):
    help = "Ejecuta periódicamente los comandos de monitoreo, cámaras e inteligencia."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Corre todo una vez y termina.")
        parser.add_argument("--tick", type=int, default=30, help="Segundos entre revisiones.")

    def _correr(self, nombre, args):
        try:
            call_command(nombre, *args)
        except Exception:
            # Una tarea que falla NO debe tirar abajo el planificador.
            self.stderr.write(self.style.ERROR(f"[{nombre}] falló:\n{traceback.format_exc()}"))

    def handle(self, *args, **opts):
        if opts["once"]:
            for nombre, _, cmd_args in TAREAS:
                self._correr(nombre, cmd_args)
            return

        ultima_ejecucion = {nombre: 0.0 for nombre, _, _ in TAREAS}
        self.stdout.write(self.style.SUCCESS("Planificador iniciado. Ctrl+C para detener."))
        try:
            while True:
                ahora = time.monotonic()
                for nombre, cada, cmd_args in TAREAS:
                    if ahora - ultima_ejecucion[nombre] >= cada:
                        self._correr(nombre, cmd_args)
                        ultima_ejecucion[nombre] = time.monotonic()
                time.sleep(opts["tick"])
        except KeyboardInterrupt:
            self.stdout.write("Planificador detenido.")
