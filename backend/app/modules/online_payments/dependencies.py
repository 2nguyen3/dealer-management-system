from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.common.pagination import CursorCodec
from app.modules.online_payments.adapter import SandboxAdapter
from app.modules.online_payments.service import OnlinePaymentService
from app.modules.online_payments.vnpay import VnpayAdapter


def adapter_for(settings):
    if not settings.payment_provider:
        return VnpayAdapter(settings) if settings.vnpay_tmn_code else None
    return SandboxAdapter(
        settings.payment_base_url,
        settings.payment_credential,
        settings.payment_callback_url,
        timeout=settings.payment_timeout_seconds,
    )


def get_online_payment_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
):
    settings = request.app.state.settings
    # Reuse the complete AuthService callback from common composition.
    from app.modules.document_core.service import DocumentService

    base = make_service(DocumentService, request, session, principal, auth)
    return OnlinePaymentService(
        session,
        base.codec,
        principal.user_id,
        request.state.request_id,
        base.authorize,
        settings,
        adapter_for(settings),
    )


def get_webhook_service(request: Request, session: SessionDependency):
    settings = request.app.state.settings
    return OnlinePaymentService(
        session,
        CursorCodec(settings.auth_signing_key.get_secret_value().encode()),
        None,
        request.state.request_id,
        lambda _: None,
        settings,
        adapter_for(settings),
    )
