import os
from functools import partial
from ipaddress import ip_address

from fastapi import Request

from app.common.catalogue_http import (
    AuthDependency,
    PrincipalDependency,
    SessionDependency,
    make_service,
)
from app.common.pagination import CursorCodec
from app.modules.online_payments.service import OnlinePaymentService
from app.modules.online_payments.vnpay import adapter_for


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


def get_online_payment_service(
    request: Request,
    session: SessionDependency,
    principal: PrincipalDependency,
    auth: AuthDependency,
) -> OnlinePaymentService:
    settings = request.app.state.settings
    service = partial(
        OnlinePaymentService,
        settings=settings,
        adapter=adapter_for(settings, ip_address=payment_client_ip(request)),
    )
    return make_service(service, request, session, principal, auth)


def get_webhook_service(request: Request, session: SessionDependency) -> OnlinePaymentService:
    """System context for verified provider callbacks: no actor, no permission check."""
    settings = request.app.state.settings
    return OnlinePaymentService(
        session,
        CursorCodec(settings.auth_signing_key.get_secret_value().encode()),
        None,
        request.state.request_id,
        lambda _: None,
        settings=settings,
        adapter=adapter_for(settings, ip_address=payment_client_ip(request)),
    )
