from rest_framework.routers import DefaultRouter
from apps.dispositivos.views import DispositivoViewSet

router = DefaultRouter()
router.register("dispositivos", DispositivoViewSet, basename="dispositivo")

urlpatterns = router.urls