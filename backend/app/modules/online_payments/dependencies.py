import os
from ipaddress import ip_address

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


def payment_client_ip(request: Request) -> str:
    candidates = []
    # Vercel overwrites X-Forwarded-For at ingress; local/Docker callers are not trusted.
    if os.environ.get("VERCEL") == "1":
        forwarded = request.headers.getlist("x-forwarded-for")
        if len(forwarded) == 1:
            candidates.append(forwarded[0])
    if request.client:
        candidates.append(request.client.host)
    for candidate in candidates:
        try:
            if "%" not in candidate:
                return str(ip_address(candidate.strip()))
        except ValueError:
            pass
    return "127.0.0.1"


def adapter_for(settings, *, ip_address="127.0.0.1"):
    if not settings.payment_provider:
        return VnpayAdapter(settings, ip_address=ip_address) if settings.vnpay_tmn_code else None
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
        adapter_for(settings, ip_address=payment_client_ip(request)),
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
        adapter_for(settings, ip_address=payment_client_ip(request)),
    )
