import uuid

from apps.accounts.models import User
from apps.accounts.repositories import UserRepository
from apps.common.exceptions import ValidationDomainError

AVATAR_MAX_BYTES = 2 * 1024 * 1024
_SIGNATURES = {b"\xff\xd8\xff": "jpg", b"\x89PNG\r\n\x1a\n": "png"}


class ProfileService:
    @staticmethod
    def update(user: User, **fields) -> User:
        email = fields.get("email")
        if email and UserRepository.email_taken(email, user.id):
            raise ValidationDomainError({"email": ["E-mail já em uso."]})
        return UserRepository.update(user, **fields)

    @staticmethod
    def set_avatar(user: User, file) -> User:
        if file is None:
            raise ValidationDomainError({"avatar": ["Arquivo obrigatório."]})
        if file.size > AVATAR_MAX_BYTES:
            raise ValidationDomainError({"avatar": ["Arquivo acima de 2 MB."]})
        content = file.read(AVATAR_MAX_BYTES + 1)
        ext = next((e for s, e in _SIGNATURES.items() if content.startswith(s)), None)
        if ext is None:
            raise ValidationDomainError({"avatar": ["Envie uma imagem JPEG ou PNG."]})
        return UserRepository.replace_avatar(user, f"{uuid.uuid4().hex}.{ext}", content)

    @staticmethod
    def clear_avatar(user: User) -> None:
        UserRepository.clear_avatar(user)
