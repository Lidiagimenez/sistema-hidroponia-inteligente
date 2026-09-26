from django.core.management.base import BaseCommand
from apps.inteligencia.services import sincronizar_todos_desde_sd


class Command(BaseCommand):
    help = "Recupera desde la SD del ESP32 las fotos que no llegaron a Django."

    def add_arguments(self, parser):
        parser.add_argument("--dias", type=int, default=1)

    def handle(self, *args, **opts):
        total = sincronizar_todos_desde_sd(dias_atras=opts["dias"])
        self.stdout.write(self.style.SUCCESS(f"Recuperadas: {total} imágenes"))