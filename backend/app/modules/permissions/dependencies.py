from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.modules.permissions.service import FunctionService, PermissionService


def get_function_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
) -> FunctionService:
    return make_service(FunctionService, request, session, principal, auth)


def get_permission_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
) -> PermissionService:
    return make_service(PermissionService, request, session, principal, auth)
