from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class DomainError(Exception):
    pass


class NotFoundError(DomainError):
    pass


class ValidationDomainError(DomainError):
    def __init__(self, errors: dict[str, list[str]]) -> None:
        self.errors = errors
        super().__init__(str(errors))


def custom_exception_handler(exc: Exception, context: object) -> Response | None:
    response = exception_handler(exc, context)
    if response is not None:
        return response
    if isinstance(exc, NotFoundError):
        return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
    if isinstance(exc, ValidationDomainError):
        return Response(
            {"detail": "Validation error", "errors": exc.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if isinstance(exc, DomainError):
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return None
