from django.core.management.base import BaseCommand
from apps.inteligencia.services import traer_capturas_de_todos


class Command(BaseCommand):
    help = "Polea los ESP32 con polling habilitado y guarda capturas periódicas."

    def handle(self, *args, **opts):
        resultado = traer_capturas_de_todos()
        self.stdout.write(self.style.SUCCESS(
            f"OK: {resultado['ok']} | Error: {resultado['error']} | "
            f"Sin URL: {resultado['sin_url']}"
        ))