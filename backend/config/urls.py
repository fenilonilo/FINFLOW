from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/v1/", include("apps.accounts.api.urls")),
    path("api/v1/", include("apps.core.api.urls")),
    path("api/v1/", include("apps.transactions.api.urls")),
    path("api/v1/", include("apps.investments.api.urls")),
    path("api/v1/", include("apps.cards.api.urls")),
    path("api/v1/", include("apps.acquisitions.api.urls")),
    path("api/v1/", include("apps.analytics.api.urls")),
]
