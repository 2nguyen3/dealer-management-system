from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.modules.stock_issues.service import StockIssueService


def get_stock_issue_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
):
    return make_service(StockIssueService, request, session, principal, auth)
