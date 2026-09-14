from django.core.management.base import BaseCommand

from apps.eventos.services import (
    detectar_sensores_sin_comunicacion, detectar_corte_electrico, detectar_bomba_sin_caudal,
)


class Command(BaseCommand):
    help = "Corre las detecciones periódicas de eventos (RF-18, RF-31, RF-32)."

    def handle(self, *args, **options):
        sin_comunicacion = detectar_sensores_sin_comunicacion()
        cortes = detectar_corte_electrico()
        bombas = detectar_bomba_sin_caudal(umbral_caudal=1.0)  # ajustar según ParametroAlerta cuando esté disponible
        self.stdout.write(self.style.SUCCESS(
            f"Sin comunicación: {len(sin_comunicacion)} | Cortes: {len(cortes)} | Bombas: {len(bombas)}"
        ))