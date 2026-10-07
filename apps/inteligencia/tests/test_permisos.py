from datetime import date, datetime
from django.utils import timezone

from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario
from apps.cultivos.models import Cultivo
from apps.inteligencia.models import (
    ParametroImagen, Recomendacion, AvisoCrecimiento, Anomalia,
)


class InteligenciaPermisosTest(APITestCase):

    def setUp(self):
        self.operador = Usuario.objects.create_user(
            username="op_test", password="test1234", rol="operador"
        )
        self.admin = Usuario.objects.create_user(
            username="adm_test", password="test1234", rol="administrador"
        )
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga test",
            fecha_creacion=date.today(),
            usuario=self.admin,
        )
        self.recomendacion = Recomendacion.objects.create(
            cultivo=self.cultivo,
            tipo="ph",
            prioridad="media",
            titulo="Ajustar pH",
            regla_origen="ph_bajo",
        )
        self.aviso = AvisoCrecimiento.objects.create(
            cultivo=self.cultivo,
            tipo="sin_crecimiento",
            descripcion="Sin cambios en 3 días",
        )

    # --- Recomendaciones: ambos pueden ver y resolver ---

    def test_operador_puede_ver_recomendaciones(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/recomendaciones/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_ver_recomendaciones(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/recomendaciones/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_operador_puede_resolver_recomendacion(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post(f"/api/recomendaciones/{self.recomendacion.pk}/resolver/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.recomendacion.refresh_from_db()
        self.assertTrue(self.recomendacion.resuelta)
        self.assertFalse(self.recomendacion.vigente)

    def test_operador_no_puede_crear_recomendacion(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/recomendaciones/", {
            "cultivo": self.cultivo.pk,
            "tipo": "ph",
            "prioridad": "alta",
            "titulo": "Nueva",
            "regla_origen": "test",
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_operador_no_puede_evaluar_motor(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/recomendaciones/evaluar/", {
            "cultivo": self.cultivo.pk,
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_si_puede_evaluar_motor(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/recomendaciones/evaluar/", {
            "cultivo": self.cultivo.pk,
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    # --- Avisos de crecimiento: ambos pueden ver y resolver ---

    def test_operador_puede_ver_avisos(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/avisos-crecimiento/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_operador_puede_resolver_aviso(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post(f"/api/avisos-crecimiento/{self.aviso.pk}/resolver/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.aviso.refresh_from_db()
        self.assertTrue(self.aviso.resuelto)

    def test_operador_no_puede_crear_aviso(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/avisos-crecimiento/", {
            "cultivo": self.cultivo.pk,
            "tipo": "sin_crecimiento",
            "descripcion": "X",
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    # --- ParametroImagen: solo admin ---

    def test_operador_puede_ver_parametros_imagen(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/parametros-imagen/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_operador_no_puede_crear_parametro_imagen(self):
        self.client.force_authenticate(self.operador)
        r = self.client.post("/api/parametros-imagen/", {
            "cultivo": self.cultivo.pk,
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_si_puede_crear_parametro_imagen(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post("/api/parametros-imagen/", {
            "cultivo": self.cultivo.pk,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # --- Anomalias: ambos pueden ver ---

    def test_operador_puede_ver_anomalias(self):
        self.client.force_authenticate(self.operador)
        r = self.client.get("/api/anomalias/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)