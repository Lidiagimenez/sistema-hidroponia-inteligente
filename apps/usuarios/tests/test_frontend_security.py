from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase


class FrontendSecurityTest(SimpleTestCase):
    def test_escape_html_helper_esta_disponible(self):
        api_js = (settings.BASE_DIR / "static" / "js" / "api.js").read_text(encoding="utf-8")

        self.assertIn("function escapeHtml", api_js)
        self.assertIn(".replace(/</g, \"&lt;\")", api_js)

    def test_campos_de_texto_libre_usan_escape_html(self):
        archivos = [
            "intervenciones.js",
            "auditoria.js",
            "ia.js",
        ]

        for archivo in archivos:
            contenido = (settings.BASE_DIR / "static" / "js" / archivo).read_text(encoding="utf-8")
            self.assertIn("escapeHtml", contenido, msg=f"Falta sanitización en {archivo}")
