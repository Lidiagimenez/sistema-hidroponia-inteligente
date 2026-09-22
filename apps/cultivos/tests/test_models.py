from datetime import date

from django.test import TestCase

from apps.cultivos.models import Cultivo, CicloProduccion
from apps.usuarios.models import Usuario


class CultivoModelTest(TestCase):

    def test_crear_cultivo(self):
        usuario = Usuario.objects.create_user(
            username="operador_test",
            password="test12345",
        )

        cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            fecha_creacion=date.today(),
            usuario=usuario,
        )

        self.assertEqual(cultivo.nombre, "Lechuga")
        self.assertEqual(cultivo.usuario, usuario)
        self.assertEqual(cultivo.tipo_cultivo, "No especificado")

    def test_crear_ciclo_produccion(self):
        usuario = Usuario.objects.create_user(
            username="operador_ciclo",
            password="test12345",
        )

        cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            fecha_creacion=date.today(),
            usuario=usuario,
        )

        ciclo = CicloProduccion.objects.create(
            cultivo=cultivo,
            fecha_inicio=date.today(),
        )

        self.assertEqual(ciclo.cultivo, cultivo)
        self.assertEqual(ciclo.estado, "germinacion")
        self.assertIsNone(ciclo.fecha_fin_estimada)