python
from rest_framework.routers import DefaultRouter
from apps.inteligencia.views import (
    ParametroImagenViewSet, AnalisisImagenViewSet,
    AvisoCrecimientoViewSet, RecomendacionViewSet,
)

router = DefaultRouter()
router.register(r"parametros-imagen", ParametroImagenViewSet, basename="parametro-imagen")
router.register(r"analisis-imagen", AnalisisImagenViewSet, basename="analisis-imagen")
router.register(r"avisos-crecimiento", AvisoCrecimientoViewSet, basename="aviso-crecimiento")
router.register(r"recomendaciones", RecomendacionViewSet, basename="recomendacion")

urlpatterns = router.urls
