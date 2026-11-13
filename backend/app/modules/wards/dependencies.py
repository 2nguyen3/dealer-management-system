from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.modules.wards.service import WardService


def get_ward_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
) -> WardService:
    return make_service(WardService, request, session, principal, auth)
