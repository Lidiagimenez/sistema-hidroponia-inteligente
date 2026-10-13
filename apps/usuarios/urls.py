from django.urls import path
from rest_framework.routers import DefaultRouter
from apps.usuarios.views import (
    CookieTokenRefreshView,
    CustomTokenObtainPairView,
    LogoutView,
    MeView,
    UsuarioViewSet,
)

router = DefaultRouter()
router.register("usuarios", UsuarioViewSet, basename="usuario")

urlpatterns = [
    path("login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("refresh/", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
] + router.urls
