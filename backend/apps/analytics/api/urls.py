from django.urls import path

from apps.analytics.api.views import (
    CategoryTrendsView,
    HealthScoreView,
    HeatmapView,
    TopCategoriesView,
    YearlyAnalyticsView,
)

urlpatterns = [
    path("analytics/yearly/", YearlyAnalyticsView.as_view(), name="analytics-yearly"),
    path(
        "analytics/health-score/",
        HealthScoreView.as_view(),
        name="analytics-health-score",
    ),
    path("analytics/heatmap/", HeatmapView.as_view(), name="analytics-heatmap"),
    path(
        "analytics/category-trends/",
        CategoryTrendsView.as_view(),
        name="analytics-category-trends",
    ),
    path(
        "analytics/top-categories/",
        TopCategoriesView.as_view(),
        name="analytics-top-categories",
    ),
]
