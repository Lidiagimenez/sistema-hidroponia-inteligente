from django.test import TestCase

from apps.auditoria.models import RegistroAuditoria
from apps.usuarios.models import Usuario


class RegistroAuditoriaModelTest(TestCase):

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            username="audit_test", password="test12345", rol=Usuario.Rol.ADMINISTRADOR,
        )

    def test_creacion_minima(self):
        registro = RegistroAuditoria.objects.create(
            usuario=self.usuario,
            accion=RegistroAuditoria.Accion.CREAR,
            entidad="Cultivo",
            objeto_id=1,
        )
        self.assertEqual(registro.accion, "crear")
        self.assertEqual(registro.entidad, "Cultivo")
        self.assertEqual(registro.detalles, {})  # default de JSONField
        self.assertIsNotNone(registro.fecha_hora)

    def test_str_trae_usuario_accion_entidad(self):
        registro = RegistroAuditoria.objects.create(
            usuario=self.usuario,
            accion=RegistroAuditoria.Accion.LOGIN,
            entidad="Usuario",
        )
        texto = str(registro)
        self.assertIn("audit_test", texto)
        self.assertIn("login", texto)
        self.assertIn("Usuario", texto)

    def test_usuario_null_para_login_fallido(self):
        registro = RegistroAuditoria.objects.create(
            usuario=None,
            accion=RegistroAuditoria.Accion.LOGIN_FALLIDO,
            entidad="Usuario",
            detalles={"username": "hacker_inventado"},
        )
        self.assertIsNone(registro.usuario)
        self.assertEqual(registro.detalles["username"], "hacker_inventado")

    def test_historial_sobrevive_al_borrar_el_usuario(self):
        registro = RegistroAuditoria.objects.create(
            usuario=self.usuario,
            accion=RegistroAuditoria.Accion.EDITAR,
            entidad="Sensor",
        )
        self.usuario.delete()
        registro.refresh_from_db()
        self.assertIsNone(registro.usuario)  # SET_NULL, no CASCADE
        self.assertEqual(registro.accion, "editar")

    def test_validacion_de_accion_con_choices(self):
        # Django valida choices en full_clean() (no en el INSERT).
        registro = RegistroAuditoria(
            usuario=self.usuario, accion="hacker_accion", entidad="Cultivo",
        )
        with self.assertRaises(Exception):
            registro.full_clean()