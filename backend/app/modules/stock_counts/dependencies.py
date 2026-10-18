from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.modules.stock_counts.service import StockCountService


def get_stock_count_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
):
    return make_service(StockCountService, request, session, principal, auth)
