from django.core.management.base import BaseCommand
from apps.inteligencia.recomendaciones import evaluar_todos_los_cultivos


class Command(BaseCommand):
    help = "Corre el motor de recomendaciones sobre todos los cultivos."

    def handle(self, *args, **opts):
        total = evaluar_todos_los_cultivos()
        self.stdout.write(self.style.SUCCESS(f"Generadas: {total} recomendaciones"))