from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.modules.users.service import UserAdministrationService


def get_user_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
) -> UserAdministrationService:
    return make_service(UserAdministrationService, request, session, principal, auth)
