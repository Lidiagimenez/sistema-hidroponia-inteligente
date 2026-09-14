from rest_framework.routers import DefaultRouter
from apps.intervenciones.views import IntervencionViewSet

router = DefaultRouter()
router.register("intervenciones", IntervencionViewSet, basename="intervencion")
urlpatterns = router.urls