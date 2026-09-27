from rest_framework.routers import DefaultRouter
from apps.reportes.views import ReporteViewSet

router = DefaultRouter()
router.register(r"reportes", ReporteViewSet, basename="reporte")

urlpatterns = router.urls