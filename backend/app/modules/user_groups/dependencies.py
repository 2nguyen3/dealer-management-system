from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.rate_limit import check_business_limit
from app.core.exceptions import AuthError
from app.db.session import get_session
from app.modules.auth.dependencies import get_auth_service, get_current_principal
from app.modules.auth.service import AuthService, Principal
from app.modules.user_groups.service import GroupService


def get_group_service(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    principal: Annotated[Principal, Depends(get_current_principal)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> GroupService:
    check_business_limit(request, principal.user_id)

    def authorize(required: tuple[str, ...]) -> None:
        if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
            raise AuthError(403, "FORBIDDEN", "Permission denied")

    return GroupService(
        session,
        CursorCodec(request.app.state.settings.auth_signing_key.get_secret_value().encode()),
        principal.user_id,
        request.state.request_id,
        authorize,
    )
