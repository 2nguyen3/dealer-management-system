from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.modules.document_core.service import DocumentService
from app.modules.online_payments.dependencies import adapter_for
from app.modules.online_payments.vnpay import provider_for
from app.modules.refunds.online import OnlineRefundService


def get_refund_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
):
    core = make_service(DocumentService, request, session, principal, auth)
    return OnlineRefundService(
        session,
        core.codec,
        principal.user_id,
        request.state.request_id,
        core.authorize,
        adapter_for(request.app.state.settings),
        provider=provider_for(request.app.state.settings),
    )
