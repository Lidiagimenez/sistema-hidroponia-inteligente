from rest_framework.routers import DefaultRouter
from apps.cultivos.views import CultivoViewSet, CicloProduccionViewSet

router = DefaultRouter()
router.register("cultivos", CultivoViewSet, basename="cultivo")
router.register("ciclos-produccion", CicloProduccionViewSet, basename="cicloproduccion")

urlpatterns = router.urls