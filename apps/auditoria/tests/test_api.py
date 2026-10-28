import uuid

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.auditoria.models import RegistroAuditoria
from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


def _login(client, username, password):
    """Login con JWT. Cada llamada usa una IP distinta para ejercer el
    throttle 'login 5/min' sin chocar entre tests (el throttle es por IP)."""
    ip = f"10.{uuid.uuid4().int % 254 + 1}.{uuid.uuid4().int % 254 + 1}.{uuid.uuid4().int % 254 + 1}"
    respuesta = client.post(
        reverse("token_obtain_pair"),
        {"username": username, "password": password},
        REMOTE_ADDR=ip,
    )
    access = respuesta.cookies["hidro_access"].value
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return respuesta


class AuditoriaApiTest(APITestCase):
    """GET /api/auditoria/ + /api/auditoria/resumen/ + permisos."""

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="audit_admin", password="test12345", rol=Usuario.Rol.ADMINISTRADOR,
        )
        self.operador = Usuario.objects.create_user(
            username="audit_op", password="test12345", rol=Usuario.Rol.OPERADOR,
        )

    def test_solo_admin_puede_listar(self):
        # Nota: el login del helper genera su propio registro LOGIN — está bien.
        RegistroAuditoria.objects.create(
            usuario=self.admin, accion=RegistroAuditoria.Accion.EDITAR, entidad="Sensor",
        )
        _login(self.client, "audit_admin", "test12345")
        respuesta = self.client.get(reverse("registro_auditoria-list"), {"accion": "editar"})
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.data["count"], 1)

    def test_operador_no_accede_a_la_auditoria(self):
        _login(self.client, "audit_op", "test12345")
        respuesta = self.client.get(reverse("registro_auditoria-list"))
        self.assertEqual(respuesta.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonimo_no_accede(self):
        respuesta = self.client.get(reverse("registro_auditoria-list"))
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_filtros_por_accion(self):
        # El login genera 1 registro; sumamos un CREAR para diferenciar.
        _login(self.client, "audit_admin", "test12345")
        RegistroAuditoria.objects.create(
            usuario=self.admin, accion=RegistroAuditoria.Accion.CREAR, entidad="Cultivo",
        )
        respuesta = self.client.get(reverse("registro_auditoria-list"), {"accion": "crear"})
        self.assertEqual(respuesta.data["count"], 1)
        self.assertEqual(respuesta.data["results"][0]["accion"], "crear")
        respuesta = self.client.get(reverse("registro_auditoria-list"), {"accion": "login"})
        self.assertEqual(respuesta.data["count"], 1)

    def test_filtro_por_fecha_desde(self):
        RegistroAuditoria.objects.create(
            usuario=self.admin, accion=RegistroAuditoria.Accion.CREAR, entidad="Cultivo",
        )
        _login(self.client, "audit_admin", "test12345")
        respuesta = self.client.get(
            reverse("registro_auditoria-list"), {"fecha_desde": "2100-01-01"}
        )
        self.assertEqual(respuesta.data["count"], 0)  # nada en el futuro
        respuesta = self.client.get(
            reverse("registro_auditoria-list"), {"fecha_desde": "2000-01-01"}
        )
        self.assertTrue(respuesta.data["count"] >= 1)

    def test_resumen_devuelve_kpis(self):
        # login del helper: 1 LOGIN. Sumamos: 2 LOGIN más, 2 EDITAR y 1 ELIMINAR.
        RegistroAuditoria.objects.create(usuario=self.admin, accion=RegistroAuditoria.Accion.LOGIN, entidad="Usuario")
        RegistroAuditoria.objects.create(usuario=self.admin, accion=RegistroAuditoria.Accion.LOGIN, entidad="Usuario")
        RegistroAuditoria.objects.create(usuario=self.admin, accion=RegistroAuditoria.Accion.EDITAR, entidad="Sensor")
        RegistroAuditoria.objects.create(usuario=self.admin, accion=RegistroAuditoria.Accion.EDITAR, entidad="Sensor")
        RegistroAuditoria.objects.create(usuario=self.admin, accion=RegistroAuditoria.Accion.ELIMINAR, entidad="Sensor")
        _login(self.client, "audit_admin", "test12345")
        respuesta = self.client.get(reverse("registro_auditoria-resumen"))
        login_records = list(RegistroAuditoria.objects.values_list("accion", flat=True))
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(
            respuesta.data["total"], 6, msg=f"DISTRIBUCION: {dict(respuesta.data)}"
        )
        self.assertEqual(
            respuesta.data["inicios_sesion"], 3, msg=f"KD: {login_records}"
        )
        self.assertEqual(respuesta.data["modificaciones"], 3)  # EDITAR + ELIMINAR
        self.assertEqual(respuesta.data["eliminaciones"], 1)
        self.assertEqual(
            respuesta.data["total"], RegistroAuditoria.objects.count()  # sin filtros = todo
        )

    def test_auditoria_no_permite_escrituras(self):
        registro = RegistroAuditoria.objects.create(
            usuario=self.admin, accion=RegistroAuditoria.Accion.EDITAR, entidad="Sensor",
        )
        _login(self.client, "audit_admin", "test12345")
        url_lista = reverse("registro_auditoria-list")
        url_detalle = reverse("registro_auditoria-detail", args=[registro.pk])
        self.assertEqual(self.client.post(url_lista, {}).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(self.client.delete(url_detalle).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class AccionesAuditadasTest(APITestCase):
    """El flujo real: login/logout al JWT + CRUD vía ViewSets."""

    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="flow_admin", password="test12345", rol=Usuario.Rol.ADMINISTRADOR,
        )

    def test_login_exitoso_se_registra(self):
        _login(self.client, "flow_admin", "test12345")
        registro = RegistroAuditoria.objects.get(accion=RegistroAuditoria.Accion.LOGIN)
        self.assertEqual(registro.usuario, self.admin)
        self.assertEqual(registro.entidad, "Usuario")
        self.assertEqual(registro.detalles["username"], "flow_admin")
        self.assertEqual(registro.detalles["rol"], Usuario.Rol.ADMINISTRADOR)
        self.assertIsNotNone(registro.ip_address)

    def test_login_fallido_se_registra_con_username_intento(self):
        self.client.post(reverse("token_obtain_pair"), {"username": "fantasma", "password": "mal"})
        registro = RegistroAuditoria.objects.get(accion=RegistroAuditoria.Accion.LOGIN_FALLIDO)
        self.assertIsNone(registro.usuario)
        self.assertEqual(registro.detalles["username"], "fantasma")

    def test_logout_se_registra(self):
        acceso = _login(self.client, "flow_admin", "test12345").cookies["hidro_access"].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {acceso}")
        self.client.post(reverse("logout"))
        self.assertTrue(
            RegistroAuditoria.objects.filter(accion=RegistroAuditoria.Accion.LOGOUT).exists()
        )

    def test_crear_cultivo_se_registra(self):
        acceso = _login(self.client, "flow_admin", "test12345").cookies["hidro_access"].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {acceso}")
        respuesta = self.client.post(
            reverse("cultivo-list"),
            {"nombre": "Lechuga Romaine", "fecha_creacion": "2026-10-26", "tipo_cultivo": "lechuga"},
        )
        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        registro = RegistroAuditoria.objects.get(
            accion=RegistroAuditoria.Accion.CREAR, entidad="Cultivo",
        )
        self.assertEqual(registro.usuario, self.admin)
        self.assertEqual(registro.objeto_id, Cultivo.objects.get().pk)

    def test_eliminar_cultivo_se_registra(self):
        # Cultivo NO tiene borrado lógico (sin is_active): delete() real.
        acceso = _login(self.client, "flow_admin", "test12345").cookies["hidro_access"].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {acceso}")
        cultivo = Cultivo.objects.create(
            nombre="Radicheta", fecha_creacion="2026-10-26", usuario=self.admin,
        )
        self.client.delete(reverse("cultivo-detail", args=[cultivo.pk]))
        registro = RegistroAuditoria.objects.get(
            accion=RegistroAuditoria.Accion.ELIMINAR, entidad="Cultivo",
        )
        self.assertEqual(registro.objeto_id, cultivo.pk)
        self.assertEqual(registro.detalles.get("modo"), "eliminacion")
        self.assertFalse(Cultivo.objects.filter(pk=cultivo.pk).exists())  # delete real

    def test_desactivar_usuario_action_se_registra_como_editar(self):
        self.operador = Usuario.objects.create_user(
            username="flow_op", password="test12345", rol=Usuario.Rol.OPERADOR,
        )
        acceso = _login(self.client, "flow_admin", "test12345").cookies["hidro_access"].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {acceso}")
        respuesta = self.client.post(reverse("usuario-desactivar", args=[self.operador.pk]))
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        registro = RegistroAuditoria.objects.get(
            accion=RegistroAuditoria.Accion.EDITAR, entidad="Usuario",
        )
        self.assertEqual(registro.objeto_id, self.operador.pk)
        self.assertEqual(registro.detalles.get("modo"), "desactivar")

    def test_llamada_anonima_no_se_audita(self):
        # POST sin usuario autenticado (simula máquina/ESP32): no debe generar
        # registro. OJO: el test client conserva las cookies del login → hay
        # que limpiarlas o seguiría autenticado (nos pasó a la primera).
        _login(self.client, "flow_admin", "test12345")
        self.client.credentials()
        self.client.cookies.clear()
        respuesta = self.client.post(
            reverse("cultivo-list"), {"nombre": "Sin usuario", "fecha_creacion": "2026-10-26"}
        )
        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(
            RegistroAuditoria.objects.filter(entidad="Cultivo", accion=RegistroAuditoria.Accion.CREAR).exists()
        )