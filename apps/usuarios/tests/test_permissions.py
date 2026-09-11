from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.usuarios.models import Usuario
from apps.usuarios.permissions import EsAdministrador, EsOperador


class PermisosBaseTest(TestCase):

    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = Usuario.objects.create_user(
            username="admin_test", password="test12345", rol=Usuario.Rol.ADMINISTRADOR,
        )
        self.operador = Usuario.objects.create_user(
            username="operador_test", password="test12345", rol=Usuario.Rol.OPERADOR,
        )

    def test_es_administrador_permite_solo_admin(self):
        request = self.factory.get("/")
        request.user = self.admin
        self.assertTrue(EsAdministrador().has_permission(request, None))

        request.user = self.operador
        self.assertFalse(EsAdministrador().has_permission(request, None))

    def test_es_operador_permite_solo_operador(self):
        request = self.factory.get("/")
        request.user = self.operador
        self.assertTrue(EsOperador().has_permission(request, None))

        request.user = self.admin
        self.assertFalse(EsOperador().has_permission(request, None))