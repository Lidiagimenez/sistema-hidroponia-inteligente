from datetime import date

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.cultivos.models import Cultivo
from apps.usuarios.models import Usuario


class ImagenUploadSecurityTest(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username="admin_upload",
            password="test12345",
            rol=Usuario.Rol.ADMINISTRADOR,
        )
        self.cultivo = Cultivo.objects.create(
            nombre="Lechuga",
            fecha_creacion=date.today(),
            usuario=self.admin,
        )
        self.client.force_authenticate(self.admin)

    def test_upload_no_imagen_es_rechazado(self):
        archivo = SimpleUploadedFile(
            "ataque.jpg",
            b"<script>alert(1)</script>",
            content_type="image/jpeg",
        )

        response = self.client.post(
            "/api/imagenes/",
            {"cultivo": self.cultivo.pk, "archivo": archivo},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_demasiado_grande_es_rechazado(self):
        archivo = SimpleUploadedFile(
            "grande.jpg",
            b"0" * (5 * 1024 * 1024 + 1),
            content_type="image/jpeg",
        )

        response = self.client.post(
            "/api/imagenes/",
            {"cultivo": self.cultivo.pk, "archivo": archivo},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
