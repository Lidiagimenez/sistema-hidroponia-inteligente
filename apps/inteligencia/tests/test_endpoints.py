from datetime import date
from django.test import TestCase
from rest_framework.test import APIClient

from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario
from apps.inteligencia.models import ParametroImagen, Recomendacion


class InteligenciaEndpointsTest(TestCase):

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_test", password="test12345",
            rol=Usuario.Rol.ADMINISTRADOR,
        )
        self.operador = Usuario.objects.create_user(
            username="op_test2", password="test12345",
            rol=Usuario.Rol.OPERADOR,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga", fecha_creacion=date.today(), usuario=self.admin,
        )

    def test_listar_parametros_vacio(self):
        r = self.client.get("/api/parametros-imagen/")
        self.assertEqual(r.status_code, 200)

    def test_crear_parametro(self):
        r = self.client.post("/api/parametros-imagen/", {
           "cultivo": self.cultivo.id_cultivo,
            "distancia_camara_cm": 25,
            "frecuencia_captura_minutos": 45,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(ParametroImagen.objects.count(), 1)

    def test_operador_no_puede_crear_parametro(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/parametros-imagen/", {
           "cultivo": self.cultivo.id_cultivo,
        }, format="json")
        self.assertIn(r.status_code, (401, 403))

    def test_listar_analisis_vacio(self):
        r = self.client.get("/api/analisis-imagen/")
        self.assertEqual(r.status_code, 200)

    def test_listar_recomendaciones_vacio(self):
        r = self.client.get("/api/recomendaciones/")
        self.assertEqual(r.status_code, 200)

    def test_resolver_recomendacion(self):
        rec = Recomendacion.objects.create(
            cultivo=self.cultivo,
            tipo=Recomendacion.Tipo.PH,
            prioridad=Recomendacion.Prioridad.ALTA,
            titulo="Test",
            regla_origen="test_regla",
        )
        r = self.client.post(f"/api/recomendaciones/{rec.id}/resolver/")
        self.assertEqual(r.status_code, 200)
        rec.refresh_from_db()
        self.assertTrue(rec.resuelta)
        self.assertFalse(rec.vigente)