from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase


class FrontendSecurityTest(SimpleTestCase):
    def test_escape_html_helper_esta_disponible(self):
        api_js = (settings.BASE_DIR / "static" / "js" / "api.js").read_text(encoding="utf-8")

        self.assertIn("function escapeHtml", api_js)
        self.assertIn(".replace(/</g, \"&lt;\")", api_js)

    def test_campos_de_texto_libre_son_sanitizados(self):
        """El texto que viene de la API nunca debe llegar crudo al HTML.

        El frontend usa dos mecanismos seguros, y ambos son válidos:
         - escapeHtml(...): al interpolar valores dentro de template literals.
         - textContent: al construir el DOM con la API nativa (no parsea HTML).
        El test exige que cada archivo use al menos uno de los dos.
        """
        archivos = [
            "intervenciones.js",
            "auditoria.js",
            "ia.js",
        ]

        for archivo in archivos:
            contenido = (settings.BASE_DIR / "static" / "js" / archivo).read_text(encoding="utf-8")
            usa_escape_html = "escapeHtml" in contenido
            usa_text_content = "textContent" in contenido
            self.assertTrue(
                usa_escape_html or usa_text_content,
                msg=f"Falta sanitización (escapeHtml o textContent) en {archivo}",
            )
