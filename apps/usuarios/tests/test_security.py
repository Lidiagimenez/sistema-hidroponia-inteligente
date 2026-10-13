from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.usuarios.models import Usuario


SECURITY_REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.usuarios.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "user": "100/min",
        "login": "2/min",
        "refresh": "10/min",
        "iot_ingesta": "60/min",
        "reportes_create": "10/min",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}


@override_settings(REST_FRAMEWORK=SECURITY_REST_FRAMEWORK)
class AuthSecurityTest(APITestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse("token_obtain_pair")
        self.user = Usuario.objects.create_user(
            username="seguridad", password="test12345", rol=Usuario.Rol.OPERADOR
        )

    def test_usuario_inactivo_no_puede_autenticarse(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        response = self.client.post(self.url, {
            "username": "seguridad",
            "password": "test12345",
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_aplica_rate_limit(self):
        for _ in range(5):
            response = self.client.post(self.url, {
                "username": "seguridad",
                "password": "mal",
            })
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post(self.url, {
            "username": "seguridad",
            "password": "mal",
        })

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
