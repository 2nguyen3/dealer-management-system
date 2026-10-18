from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AuthError
from app.db.session import get_session
from app.modules.auth.permissions import FUNCTION_CODES
from app.modules.auth.service import AuthService, Principal

bearer = HTTPBearer(auto_error=False, scheme_name="BearerAuth", bearerFormat="JWT")


def get_auth_service(
    request: Request, session: Annotated[Session, Depends(get_session)]
) -> AuthService:
    return AuthService(session, request.app.state.settings, request.app.state.reset_delivery)


def get_current_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Bearer authentication required")
    return service.authenticate(credentials.credentials)


def require_permissions(
    *, all_of: tuple[str, ...] = (), any_of: tuple[str, ...] = ()
) -> Callable[..., Principal]:
    all_of, any_of = tuple(all_of), tuple(any_of)
    if not all_of and not any_of:
        raise ValueError("Permission policy must not be empty")
    if not set(all_of + any_of) <= FUNCTION_CODES:
        raise ValueError("Unknown permission code")

    def dependency(
        principal: Annotated[Principal, Depends(get_current_principal)],
        service: Annotated[AuthService, Depends(get_auth_service)],
    ) -> Principal:
        allowed = set(service.get_current_user(principal).allowedFunctions)
        if not set(all_of) <= allowed or (any_of and not set(any_of) & allowed):
            raise AuthError(403, "FORBIDDEN", "Permission denied")
        return principal

    return dependency
