from typing import Annotated

from fastapi import APIRouter, Depends, Response
from fastapi.security import HTTPAuthorizationCredentials

from app.common.catalogue_http import responses
from app.common.transport import BusinessRoute
from app.core.exceptions import AuthError
from app.modules.auth.dependencies import bearer
from app.modules.dashboard.dependencies import get_dashboard_service
from app.modules.dashboard.schemas import DashboardResponse, Month
from app.modules.dashboard.service import ADMISSION, DashboardService

router = APIRouter(tags=["Dashboard"], route_class=BusinessRoute)


@router.get(
    "/dashboard",
    operation_id="getDashboard",
    response_model=DashboardResponse,
    response_model_exclude_none=True,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": {"anyOf": list(ADMISSION)}},
)
def get_dashboard(
    month: Month,
    response: Response,
    service: Annotated[DashboardService, Depends(get_dashboard_service)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Bearer authentication required")
    response.headers["Cache-Control"] = "private, no-store"
    return service.get(credentials.credentials, month)
