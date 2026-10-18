from app.common.schemas import FieldError


class ApiError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        *,
        fields: list[FieldError] | None = None,
        details: dict | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields
        self.details = details
        self.headers = headers or {}


class AuthError(Exception):
    def __init__(
        self, status: int, code: str, message: str, retry_after: int | None = None
    ) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message
        self.retry_after = retry_after
