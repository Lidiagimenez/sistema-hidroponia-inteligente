"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path("admin/", admin.site.urls),

    # --- Páginas de autenticación ---
    path("login/", TemplateView.as_view(template_name="auth/login.html"), name="login"),

    # --- Landing pública ---
    path("", TemplateView.as_view(template_name="landing/index.html"), name="landing"),

    # --- App (requieren login) ---
    path("dashboard/", TemplateView.as_view(template_name="dashboard/index.html"), name="dashboard"),
    path("alertas/", TemplateView.as_view(template_name="alertas/index.html"), name="alertas"),
    path("monitoreo/", TemplateView.as_view(template_name="monitoreo/index.html"), name="monitoreo"),
    path("cultivos/", TemplateView.as_view(template_name="cultivos/index.html"), name="cultivos"),
    path("intervenciones/", TemplateView.as_view(template_name="intervenciones/index.html"), name="intervenciones"),
    path("ia/", TemplateView.as_view(template_name="en-construccion.html"), name="ia"),
    path("imagenes/", TemplateView.as_view(template_name="en-construccion.html"), name="imagenes"),
    path("reportes/", TemplateView.as_view(template_name="en-construccion.html"), name="reportes"),

    # --- Administración (solo admin) ---
    path("usuarios/", TemplateView.as_view(template_name="en-construccion.html"), name="usuarios"),
    path("dispositivos/", TemplateView.as_view(template_name="en-construccion.html"), name="dispositivos"),
    path("configuracion-sensores/", TemplateView.as_view(template_name="en-construccion.html"), name="configuracion-sensores"),
    path("rangos-operacion/", TemplateView.as_view(template_name="en-construccion.html"), name="rangos-operacion"),
    path("auditoria/", TemplateView.as_view(template_name="en-construccion.html"), name="auditoria"),

    # --- API REST ---
    path("api/", include("apps.usuarios.urls")),
    path("api/", include("apps.cultivos.urls")),
    path("api/", include("apps.dispositivos.urls")),
    path("api/", include("apps.monitoreo.urls")),
    path("api/", include("apps.eventos.urls")),
    path("api/", include("apps.alertas.urls")),
    path("api/", include("apps.intervenciones.urls")),
    path("api/", include("apps.inteligencia.urls")),
    path("api/", include("apps.reportes.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)