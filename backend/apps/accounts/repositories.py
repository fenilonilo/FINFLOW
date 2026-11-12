from django.core.files.base import ContentFile

from apps.accounts.models import DeviceSession, User


class UserRepository:
    @staticmethod
    def get_id_by_email(email: str) -> int | None:
        return (
            User.objects.filter(email__iexact=email)
            .values_list("id", flat=True)
            .first()
        )

    @staticmethod
    def email_taken(email: str, exclude_id: int) -> bool:
        return User.objects.filter(email__iexact=email).exclude(id=exclude_id).exists()

    @staticmethod
    def update(user: User, **fields) -> User:
        for k, v in fields.items():
            setattr(user, k, v)
        user.save()
        return user

    @staticmethod
    def replace_avatar(user: User, name: str, content: bytes) -> User:
        old = user.avatar.name
        user.avatar.save(name, ContentFile(content), save=True)
        if old:
            user.avatar.storage.delete(old)
        return user

    @staticmethod
    def clear_avatar(user: User) -> None:
        if user.avatar:
            user.avatar.delete(save=True)


class DeviceSessionRepository:
    @staticmethod
    def create(user: User, device_name: str) -> DeviceSession:
        return DeviceSession.objects.create(user=user, device_name=device_name)

    @staticmethod
    def list_active(user: User):
        return DeviceSession.objects.filter(user=user, revoked=False).order_by(
            "-created_at", "-id"
        )

    @staticmethod
    def last_seen_if_active(sid: int, user_id: int):
        """last_seen_at da sessao ativa, ou None se inexistente/revogada."""
        return (
            DeviceSession.objects.filter(pk=sid, user_id=user_id, revoked=False)
            .values_list("last_seen_at", flat=True)
            .first()
        )

    @staticmethod
    def touch(sid: int, when) -> None:
        # update() nao dispara auto_now: o horario e o informado
        DeviceSession.objects.filter(pk=sid).update(last_seen_at=when)

    @staticmethod
    def revoke(user: User, sid: int) -> bool:
        return bool(
            DeviceSession.objects.filter(pk=sid, user=user).update(revoked=True)
        )

    @staticmethod
    def is_active(sid: int) -> bool:
        return DeviceSession.objects.filter(pk=sid, revoked=False).exists()
