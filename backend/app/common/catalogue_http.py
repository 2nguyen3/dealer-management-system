from typing import Annotated, Literal

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.rate_limit import check_business_limit
from app.common.responses import ERROR_SCHEMA
from app.core.exceptions import AuthError
from app.db.session import get_session
from app.modules.auth.dependencies import get_auth_service, get_current_principal
from app.modules.auth.service import AuthService, Principal

CatalogSort = Literal["id", "-id", "code", "-code", "name", "-name"]
MasterStatus = Literal["ACTIVE", "INACTIVE"]
MatchHeader = Annotated[str, Header(alias="If-Match", pattern='^"[^"]+"$')]
SessionDependency = Annotated[Session, Depends(get_session)]
PrincipalDependency = Annotated[Principal, Depends(get_current_principal)]
AuthDependency = Annotated[AuthService, Depends(get_auth_service)]


def make_service(
    service_type, request: Request, session: Session, principal: Principal, auth: AuthService
):
    check_business_limit(request, principal.user_id)

    def authorize(required: tuple[str, ...]) -> None:
        if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
            raise AuthError(403, "FORBIDDEN", "Permission denied")

    return service_type(
        session,
        CursorCodec(request.app.state.settings.auth_signing_key.get_secret_value().encode()),
        principal.user_id,
        request.state.request_id,
        authorize,
    )


def responses(*statuses: int, etag: bool = False) -> dict:
    result = {}
    for status in statuses:
        headers = {"X-Request-Id": {"schema": {"type": "string"}}}
        if status == 401:
            headers["WWW-Authenticate"] = {"schema": {"type": "string"}}
        if status == 429:
            headers["Retry-After"] = {"schema": {"type": "integer", "minimum": 1}}
        if status == 412 or (etag and status in (200, 201)):
            headers["ETag"] = {"schema": {"type": "string", "pattern": '^"[^"]+"$'}}
        if status == 201:
            headers["Location"] = {"schema": {"type": "string", "format": "uri-reference"}}
        result[status] = {"description": "Resource response", "headers": headers}
        if status >= 400:
            result[status]["content"] = {"application/json": {"schema": ERROR_SCHEMA}}
    return result
