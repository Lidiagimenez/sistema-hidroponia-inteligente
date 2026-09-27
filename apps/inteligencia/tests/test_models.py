from datetime import date
from django.test import TestCase
from django.utils import timezone

from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario
from apps.inteligencia.models import (
    ParametroImagen, AnalisisImagen, AvisoCrecimiento, Recomendacion,
)


class InteligenciaModelsTest(TestCase):

    def setUp(self):
        self.user = Usuario.objects.create_user(
            username="op_test", password="test12345",
        )
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga", fecha_creacion=date.today(), usuario=self.user,
        )

    def test_crear_parametro_imagen_con_defaults(self):
        p = ParametroImagen.objects.create(cultivo=self.cultivo)
        self.assertEqual(p.frecuencia_captura_minutos, 30)
        self.assertEqual(p.hora_inicio_captura, 8)
        self.assertEqual(p.hora_fin_captura, 19)
        self.assertEqual(p.retencion_dias, 7)
        self.assertTrue(p.capturar_por_evento)
        self.assertEqual(p.curva_esperada, {})

    def test_crear_analisis_sin_metricas(self):
        a = AnalisisImagen.objects.create(
            cultivo=self.cultivo,
            imagen="analisis/test.jpg",
            fecha_hora=timezone.now(),
        )
        self.assertIsNone(a.altura_estimada_cm)
        self.assertFalse(a.procesada)
        self.assertEqual(a.origen_captura, "periodica")

    def test_crear_aviso_crecimiento(self):
        a = AnalisisImagen.objects.create(
            cultivo=self.cultivo,
            imagen="analisis/test.jpg",
            fecha_hora=timezone.now(),
        )
        aviso = AvisoCrecimiento.objects.create(
            cultivo=self.cultivo,
            tipo=AvisoCrecimiento.Tipo.SIN_CRECIMIENTO,
            analisis_origen=a,
            descripcion="Test",
        )
        self.assertEqual(aviso.severidad, AvisoCrecimiento.Severidad.INFO)
        self.assertFalse(aviso.resuelto)

    def test_aviso_sobrevive_al_borrado_de_imagen(self):
        a = AnalisisImagen.objects.create(
            cultivo=self.cultivo,
            imagen="analisis/test.jpg",
            fecha_hora=timezone.now(),
        )
        aviso = AvisoCrecimiento.objects.create(
            cultivo=self.cultivo,
            tipo=AvisoCrecimiento.Tipo.SIN_CRECIMIENTO,
            analisis_origen=a,
            descripcion="Test",
        )
        a.delete()
        aviso.refresh_from_db()
        self.assertIsNone(aviso.analisis_origen)

    def test_crear_recomendacion(self):
        rec = Recomendacion.objects.create(
            cultivo=self.cultivo,
            tipo=Recomendacion.Tipo.PH,
            prioridad=Recomendacion.Prioridad.ALTA,
            titulo="Test",
            regla_origen="test_regla",
        )
        self.assertTrue(rec.vigente)
        self.assertFalse(rec.resuelta)