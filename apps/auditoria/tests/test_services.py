from unittest.mock import patch

from django.test import RequestFactory, TestCase

from apps.auditoria.models import RegistroAuditoria
from apps.auditoria.services import obtener_ip, registrar_auditoria
from apps.usuarios.models import Usuario


class ObtenerIpTest(TestCase):

    def setUp(self):
        self.factory = RequestFactory()

    def test_ip_remota_simple(self):
        request = self.factory.post("/", REMOTE_ADDR="192.168.1.5")
        self.assertEqual(obtener_ip(request), "192.168.1.5")

    def test_preferencia_por_x_forwarded_for(self):
        request = self.factory.post(
            "/",
            REMOTE_ADDR="10.0.0.1",
            HTTP_X_FORWARDED_FOR="203.0.113.9, 10.0.0.2",
        )
        self.assertEqual(obtener_ip(request), "203.0.113.9")

    def test_sin_request_devuelve_none(self):
        self.assertIsNone(obtener_ip(None))


class RegistrarAuditoriaTest(TestCase):

    def setUp(self):
        self.factory = RequestFactory()
        self.usuario = Usuario.objects.create_user(
            username="serv_test", password="test12345", rol=Usuario.Rol.ADMINISTRADOR,
        )

    def test_registra_con_usuario_autenticado(self):
        request = self.factory.post("/", REMOTE_ADDR="192.168.1.10")
        request.user = self.usuario
        registrar_auditoria(request, RegistroAuditoria.Accion.CREAR, "Cultivo", objeto_id=3)
        registro = RegistroAuditoria.objects.get()
        self.assertEqual(registro.usuario, self.usuario)
        self.assertEqual(registro.ip_address, "192.168.1.10")
        self.assertEqual(registro.objeto_id, 3)

    def test_registra_sin_usuario(self):
        request = self.factory.post("/", REMOTE_ADDR="192.168.1.10")
        request.user = None
        registrar_auditoria(request, RegistroAuditoria.Accion.LOGIN_FALLIDO, "Usuario")
        registro = RegistroAuditoria.objects.get()
        self.assertIsNone(registro.usuario)

    def test_fallo_de_registro_no_rompe_el_flujo(self):
        # Simulamos caída de la BD: la llamada NO debe lanzar excepción,
        # porque la auditoría jamás puede frenar una acción real del sistema.
        request = self.factory.post("/")
        request.user = self.usuario
        with patch.object(RegistroAuditoria.objects, "create", side_effect=RuntimeError("BD caída")):
            registrar_auditoria(request, RegistroAuditoria.Accion.CREAR, "Cultivo")
        self.assertEqual(RegistroAuditoria.objects.count(), 0)