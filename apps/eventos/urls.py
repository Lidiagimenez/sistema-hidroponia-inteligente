from rest_framework.routers import DefaultRouter
from apps.eventos.views import EventoViewSet

router = DefaultRouter()
router.register("eventos", EventoViewSet, basename="evento")
urlpatterns = router.urls