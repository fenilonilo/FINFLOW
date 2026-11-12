from apps.accounts.models import User


class UserRepository:
    @staticmethod
    def get_id_by_email(email: str) -> int | None:
        return (
            User.objects.filter(email__iexact=email)
            .values_list("id", flat=True)
            .first()
        )
