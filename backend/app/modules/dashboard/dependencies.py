from functools import partial

from fastapi import Request

from app.common.rate_limit import check_business_limit
from app.modules.dashboard.service import DashboardService


def get_dashboard_service(request: Request) -> DashboardService:
    return DashboardService(
        request.app.state.engine,
        request.app.state.settings,
        request.app.state.reset_delivery,
        limiter=partial(check_business_limit, request),
    )
