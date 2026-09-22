from rest_framework.routers import DefaultRouter
from apps.alertas.views import ParametroAlertaViewSet, AlertaViewSet

router = DefaultRouter()
router.register("parametros-alerta", ParametroAlertaViewSet, basename="parametroalerta")
router.register("alertas", AlertaViewSet, basename="alerta")
urlpatterns = router.urls