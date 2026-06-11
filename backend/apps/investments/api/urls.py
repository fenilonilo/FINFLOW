from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.investments.api.views import InvestmentGoalViewSet, InvestmentViewSet

router = DefaultRouter()
router.register("investments", InvestmentViewSet, basename="investment")
router.register("investment-goals", InvestmentGoalViewSet, basename="investment-goal")

urlpatterns = [path("", include(router.urls))]
