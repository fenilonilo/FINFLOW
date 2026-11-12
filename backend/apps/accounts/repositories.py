from django.core.files.base import ContentFile

from apps.accounts.models import User


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
