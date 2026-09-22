from rest_framework.routers import DefaultRouter
from apps.monitoreo.views import (
    TipoSensorViewSet, SensorViewSet, RangoOperacionViewSet, MedicionViewSet, ImagenViewSet,
)

router = DefaultRouter()
router.register("tipos-sensor", TipoSensorViewSet, basename="tiposensor")
router.register("sensores", SensorViewSet, basename="sensor")
router.register("rangos-operacion", RangoOperacionViewSet, basename="rangooperacion")
router.register("mediciones", MedicionViewSet, basename="medicion")
router.register("imagenes", ImagenViewSet, basename="imagen")

urlpatterns = router.urls