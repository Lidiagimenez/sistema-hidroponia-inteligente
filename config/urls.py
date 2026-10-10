"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
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
    path("imagenes/", TemplateView.as_view(template_name="imagenes/index.html"), name="imagenes"),
    path("reportes/", TemplateView.as_view(template_name="reportes/index.html"), name="reportes"),
    path("ia/", TemplateView.as_view(template_name="ia/index.html"), name="ia"),

    # --- Administración (solo admin) ---
    path("usuarios/", TemplateView.as_view(template_name="usuarios/index.html"), name="usuarios"),
    path("dispositivos/", TemplateView.as_view(template_name="dispositivos/index.html"), name="dispositivos"),
    path("configuracion-sensores/", TemplateView.as_view(template_name="configuracion-sensores/index.html"), name="configuracion-sensores"),
    path("rangos-operacion/", TemplateView.as_view(template_name="rangos-operacion/index.html"), name="rangos-operacion"),
    path("auditoria/", TemplateView.as_view(template_name="auditoria/index.html"), name="auditoria"),

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

# ============================================================
# ADMIN DE DJANGO (SOLO EN DESARROLLO)
# URL custom para que no sea fácil de adivinar.
# En producción (DEBUG=False) esta ruta NO existe.
# ============================================================
if settings.DEBUG:
    urlpatterns += [
        path("panel-interno/", admin.site.urls),
    ]

# Servir archivos media en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)