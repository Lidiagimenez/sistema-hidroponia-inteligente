from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from apps.usuarios.models import Usuario


class AuthAPITest(APITestCase):

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            username="test_login", password="test12345", rol=Usuario.Rol.OPERADOR,
        )

    def test_login_devuelve_tokens_y_rol(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {"username": "test_login", "password": "test12345"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["rol"], Usuario.Rol.OPERADOR)

    def test_login_credenciales_invalidas(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {"username": "test_login", "password": "mal"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_valido(self):
        login_url = reverse("token_obtain_pair")
        login_response = self.client.post(login_url, {"username": "test_login", "password": "test12345"})
        refresh = login_response.data["refresh"]

        refresh_url = reverse("token_refresh")
        response = self.client.post(refresh_url, {"refresh": refresh})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_logout_invalida_refresh_token(self):
        login_url = reverse("token_obtain_pair")
        login_response = self.client.post(login_url, {"username": "test_login", "password": "test12345"})
        access = login_response.data["access"]
        refresh = login_response.data["refresh"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        logout_url = reverse("logout")
        response = self.client.post(logout_url, {"refresh": refresh})
        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

        # el mismo refresh ya no debe poder usarse
        refresh_url = reverse("token_refresh")
        response2 = self.client.post(refresh_url, {"refresh": refresh})
        self.assertEqual(response2.status_code, status.HTTP_401_UNAUTHORIZED)