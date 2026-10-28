from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.inteligencia.views import (
    ParametroImagenViewSet,
    AnalisisImagenViewSet,
    AvisoCrecimientoViewSet,
    RecomendacionViewSet,
    AnomaliaViewSet,
    PrediccionAPIView,
)

router = DefaultRouter()
router.register(r"parametros-imagen", ParametroImagenViewSet, basename="parametro-imagen")
router.register(r"analisis-imagen", AnalisisImagenViewSet, basename="analisis-imagen")
router.register(r"avisos-crecimiento", AvisoCrecimientoViewSet, basename="aviso-crecimiento")
router.register(r"recomendaciones", RecomendacionViewSet, basename="recomendacion")
router.register(r"anomalias", AnomaliaViewSet, basename="anomalia")

urlpatterns = [
    path("predicciones/", PrediccionAPIView.as_view(), name="predicciones"),
] + router.urls