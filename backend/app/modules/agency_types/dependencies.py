from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.modules.agency_types.service import AgencyTypeService


def get_agency_type_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
) -> AgencyTypeService:
    return make_service(AgencyTypeService, request, session, principal, auth)
