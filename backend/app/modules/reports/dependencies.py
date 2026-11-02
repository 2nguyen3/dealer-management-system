from fastapi import Request

from app.common.catalogue_http import PrincipalDependency, SessionDependency
from app.common.pagination import CursorCodec
from app.common.rate_limit import check_business_limit
from app.modules.reports.service import ReportService


def get_report_service(
    request: Request, session: SessionDependency, principal: PrincipalDependency
):
    check_business_limit(request, principal.user_id)
    return ReportService(
        session,
        CursorCodec(request.app.state.settings.auth_signing_key.get_secret_value().encode()),
    )
