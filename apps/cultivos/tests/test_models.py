from datetime import date

from django.test import TestCase

from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class CultivoModelTest(TestCase):

    def test_crear_cultivo(self):
        usuario = Usuario.objects.create_user(
            username="operador_test",
            password="test12345",
        )

        cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            descripcion="Cultivo de prueba",
            fecha_inicio=date.today(),
            usuario=usuario,
        )

        self.assertEqual(cultivo.nombre, "Lechuga")
        self.assertEqual(cultivo.usuario, usuario)
        self.assertTrue(cultivo.activo)

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
            descripcion="Cultivo de prueba",
            fecha_inicio=date.today(),
            usuario=usuario,
        )

        self.assertEqual(cultivo.nombre, "Lechuga")
        self.assertEqual(cultivo.usuario, usuario)
        self.assertTrue(cultivo.activo)

    def test_crear_ciclo_produccion(self):
        usuario = Usuario.objects.create_user(
            username="operador_ciclo",
            password="test12345",
        )

        cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            fecha_inicio=date.today(),
            usuario=usuario,
        )

        ciclo = CicloProduccion.objects.create(
            cultivo=cultivo,
            fecha_inicio=date.today(),
        )

        self.assertEqual(ciclo.cultivo, cultivo)
        self.assertTrue(ciclo.activo)
        self.assertIsNone(ciclo.fecha_fin)