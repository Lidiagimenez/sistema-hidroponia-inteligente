from django.core.management.base import BaseCommand
from apps.inteligencia.services import limpiar_imagenes_antiguas


class Command(BaseCommand):
    help = "Borra imágenes más viejas que el período de retención configurado."

    def handle(self, *args, **opts):
        total = limpiar_imagenes_antiguas()
        self.stdout.write(self.style.SUCCESS(f"Borradas: {total} imágenes"))