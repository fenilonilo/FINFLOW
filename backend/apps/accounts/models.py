from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    username = None  # type: ignore[assignment]
    email = models.EmailField(unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []  # type: ignore[misc]

    class Meta:
        db_table = "accounts_user"


class DeviceSession(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="device_sessions"
    )
    device_name = models.CharField(max_length=80)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked = models.BooleanField(default=False)

    class Meta:
        db_table = "accounts_devicesession"
