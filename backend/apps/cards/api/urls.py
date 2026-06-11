from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.cards.api.views import CardInvoiceViewSet, CardViewSet

router = DefaultRouter()
router.register("cards", CardViewSet, basename="card")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "cards/<int:card_pk>/invoices/",
        CardInvoiceViewSet.as_view({"get": "list", "post": "create"}),
        name="card-invoices",
    ),
    path(
        "cards/<int:card_pk>/invoices/<int:pk>/",
        CardInvoiceViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="card-invoice-detail",
    ),
]
