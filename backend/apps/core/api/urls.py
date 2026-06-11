from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.core.api.views import CategoryViewSet, PaymentMethodViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("payment-methods", PaymentMethodViewSet, basename="payment-method")

urlpatterns = [path("", include(router.urls))]
