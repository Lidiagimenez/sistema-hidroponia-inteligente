import tempfile
from datetime import date
from io import StringIO
from unittest.mock import MagicMock, patch

import requests
from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.cultivos.models import Cultivo
from apps.dispositivos.models import Dispositivo
from apps.inteligencia import services
from apps.inteligencia.models import AnalisisImagen
from apps.usuarios.models import Usuario

MEDIA_TMP = tempfile.mkdtemp()


def _respuesta(contenido=b"\xff\xd8\xff-foto-falsa"):
    r = MagicMock()
    r.content = contenido
    r.raise_for_status.return_value = None
    return r


@override_settings(MEDIA_ROOT=MEDIA_TMP)
class CamarasTest(TestCase):
    def setUp(self):
        usuario = Usuario.objects.create_user(username="u_cam", password="test12345")
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga", fecha_creacion=date.today(), usuario=usuario
        )
        self.camara = Dispositivo.objects.create(
            nombre="ESP32-CAM", tipo_dispositivo="otro", identificador_hardware="HW-CAM",
            cultivo=self.cultivo, ip_local="192.168.1.50", permite_polling=True,
        )

    @patch("apps.inteligencia.services.requests.get")
    def test_traer_captura_guarda_analisis(self, mock_get):
        mock_get.return_value = _respuesta()
        analisis = services.traer_captura(self.camara)
        self.assertIsNotNone(analisis)
        self.assertTrue(analisis.procesada)
        self.assertEqual(AnalisisImagen.objects.count(), 1)
        mock_get.assert_called_once()
        self.assertIn("192.168.1.50", mock_get.call_args[0][0])

    @patch("apps.inteligencia.services.requests.get")
    def test_no_duplica_la_misma_imagen(self, mock_get):
        mock_get.return_value = _respuesta()
        services.traer_captura(self.camara)
        self.assertIsNone(services.traer_captura(self.camara))
        self.assertEqual(AnalisisImagen.objects.count(), 1)

    @patch("apps.inteligencia.services.requests.get", side_effect=requests.ConnectionError)
    def test_camara_caida_no_explota(self, _):
        self.assertIsNone(services.traer_captura(self.camara))
        self.assertEqual(AnalisisImagen.objects.count(), 0)

    def test_dispositivo_sin_url_no_hace_request(self):
        sin_url = Dispositivo.objects.create(
            nombre="Sin red", tipo_dispositivo="otro", identificador_hardware="HW-NOURL",
            cultivo=self.cultivo, permite_polling=True,
        )
        with patch("apps.inteligencia.services.requests.get") as mock_get:
            self.assertIsNone(services.traer_captura(sin_url))
            mock_get.assert_not_called()

    @patch("apps.inteligencia.services.requests.get")
    def test_traer_capturas_de_todos_cuenta_resultados(self, mock_get):
        mock_get.return_value = _respuesta()
        Dispositivo.objects.create(
            nombre="Sin red", tipo_dispositivo="otro", identificador_hardware="HW-NOURL2",
            cultivo=self.cultivo, permite_polling=True,
        )
        resultado = services.traer_capturas_de_todos()
        self.assertEqual(resultado, {"ok": 1, "error": 0, "sin_url": 1})

    @patch("apps.inteligencia.services.requests.get")
    def test_ignora_dispositivos_inactivos_o_sin_polling(self, mock_get):
        mock_get.return_value = _respuesta()
        self.camara.estado = Dispositivo.Estado.INACTIVO
        self.camara.save()
        self.assertEqual(services.traer_capturas_de_todos(), {"ok": 0, "error": 0, "sin_url": 0})

    @patch("apps.inteligencia.services.requests.get")
    def test_comando_poll_camaras(self, mock_get):
        mock_get.return_value = _respuesta()
        salida = StringIO()
        call_command("poll_camaras", stdout=salida)
        self.assertIn("OK: 1", salida.getvalue())

    def test_comando_sync_camaras_sin_fotos(self):
        with patch("apps.inteligencia.services.requests.get") as mock_get:
            mock_get.return_value = MagicMock(json=lambda: [], raise_for_status=lambda: None)
            salida = StringIO()
            call_command("sync_camaras", "--dias", "1", stdout=salida)
        self.assertIn("Recuperadas: 0", salida.getvalue())
