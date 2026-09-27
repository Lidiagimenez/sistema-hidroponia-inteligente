from datetime import date
from django.test import TestCase

from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario
from apps.inteligencia.recomendaciones import evaluar_recomendaciones
from apps.inteligencia.models import Recomendacion


class RecomendacionesTest(TestCase):
    """
    Test mínimo: verifica que el motor corre sin romperse.
    """

    def setUp(self):
        self.user = Usuario.objects.create_user(
            username="op_test_rec", password="test12345",
        )
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga", fecha_creacion=date.today(), usuario=self.user,
        )

    def test_motor_corre_sin_romperse(self):
        generadas = evaluar_recomendaciones(self.cultivo)
        self.assertIsInstance(generadas, list)

    def test_no_duplica_recomendaciones(self):
        evaluar_recomendaciones(self.cultivo, throttle_horas=6)
        primera_cantidad = Recomendacion.objects.count()

        evaluar_recomendaciones(self.cultivo, throttle_horas=6)
        segunda_cantidad = Recomendacion.objects.count()

        self.assertEqual(primera_cantidad, segunda_cantidad)
        