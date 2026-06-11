import os

from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True

DATABASES["default"]["HOST"] = os.environ.get("POSTGRES_HOST", "db")  # noqa: F405
