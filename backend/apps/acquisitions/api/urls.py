from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.acquisitions.api.views import AcquisitionViewSet

router = DefaultRouter()
router.register("acquisitions", AcquisitionViewSet, basename="acquisition")

urlpatterns = [path("", include(router.urls))]
