from rest_framework.routers import DefaultRouter

from apps.auditoria.views import RegistroAuditoriaViewSet

router = DefaultRouter()
router.register("auditoria", RegistroAuditoriaViewSet, basename="registro_auditoria")
urlpatterns = router.urls