from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.transactions.api.views import (
    DebtViewSet,
    GenerateFixedView,
    MonthSummaryView,
    RecurringExpenseViewSet,
    TransactionViewSet,
)

router = DefaultRouter()
router.register("transactions", TransactionViewSet, basename="transaction")
router.register(
    "recurring-expenses", RecurringExpenseViewSet, basename="recurring-expense"
)
router.register("debts", DebtViewSet, basename="debt")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "months/<int:year>/<int:month>/summary/",
        MonthSummaryView.as_view({"get": "retrieve"}),
        name="month-summary",
    ),
    path(
        "months/<int:year>/<int:month>/generate-fixed/",
        GenerateFixedView.as_view({"post": "create"}),
        name="generate-fixed",
    ),
]
