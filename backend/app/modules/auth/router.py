from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.common.responses import ERROR_SCHEMA
from app.modules.auth.dependencies import get_auth_service, get_current_principal
from app.modules.auth.rate_limit import build_rate_limit_key
from app.modules.auth.schemas import (
    AcceptedMessage,
    ChangePasswordRequest,
    CurrentUser,
    EmailRequest,
    LoginRequest,
    PasswordResetRequest,
    RefreshRequest,
    TokenResponse,
)
from app.modules.auth.service import AuthService, Principal

router = APIRouter(prefix="/auth", tags=["Authentication"])
Service = Annotated[AuthService, Depends(get_auth_service)]
Authenticated = Annotated[Principal, Depends(get_current_principal)]


def responses(*statuses: int) -> dict:
    result = {}
    for status in statuses:
        headers = {"X-Request-Id": {"schema": {"type": "string"}}}
        if status == 401:
            headers["WWW-Authenticate"] = {"schema": {"type": "string"}}
        if status in (429, 503):
            headers["Retry-After"] = {"schema": {"type": "integer", "minimum": 1}}
        result[status] = {"description": "Authentication response", "headers": headers}
        if status >= 400:
            result[status]["content"] = {"application/json": {"schema": ERROR_SCHEMA}}
        if status == 200:
            headers["Cache-Control"] = {"schema": {"type": "string", "const": "no-store"}}
    return result


def check_identity_limit(request: Request, operation: str, email: str) -> None:
    settings = request.app.state.settings
    address = request.client.host if request.client else "unknown"
    key = build_rate_limit_key(
        operation, address, email, secret=settings.auth_signing_key.get_secret_value().encode()
    )
    limit = settings.auth_login_limit if operation == "login" else settings.auth_reset_request_limit
    window = (
        settings.auth_login_window_seconds
        if operation == "login"
        else settings.auth_reset_request_window_seconds
    )
    request.app.state.auth_limiter.check(key, limit, window)


@router.post(
    "/login",
    operation_id="login",
    response_model=TokenResponse,
    responses=responses(200, 400, 401, 403, 415, 422, 429, 500),
    openapi_extra={"security": []},
)
def login(body: LoginRequest, request: Request, service: Service) -> TokenResponse:
    check_identity_limit(request, "login", body.email)
    return service.login(body.email, body.password)


@router.post(
    "/refresh",
    operation_id="refreshTokens",
    response_model=TokenResponse,
    responses=responses(200, 400, 401, 403, 415, 422, 429, 500),
    openapi_extra={"security": []},
)
def refresh_tokens(body: RefreshRequest, service: Service) -> TokenResponse:
    return service.refresh_tokens(body.refreshToken)


@router.post(
    "/logout",
    operation_id="logout",
    status_code=204,
    responses=responses(204, 400, 415, 422, 429, 500),
    openapi_extra={"security": []},
)
def logout(body: RefreshRequest, service: Service) -> Response:
    service.logout(body.refreshToken)
    return Response(status_code=204)


@router.get(
    "/me",
    operation_id="getCurrentUser",
    response_model=CurrentUser,
    responses=responses(200, 401, 403, 429, 500),
)
def get_current_user(principal: Authenticated, service: Service) -> CurrentUser:
    return service.get_current_user(principal)


@router.put(
    "/password",
    operation_id="changePassword",
    status_code=204,
    responses=responses(204, 400, 401, 403, 415, 422, 429, 500),
)
def change_password(
    body: ChangePasswordRequest, request: Request, principal: Authenticated, service: Service
) -> Response:
    service.change_password(
        principal, body.currentPassword, body.newPassword, request.state.request_id
    )
    return Response(status_code=204)


@router.post(
    "/password-reset-requests",
    operation_id="requestPasswordReset",
    status_code=202,
    response_model=AcceptedMessage,
    responses=responses(202, 400, 415, 422, 429, 500, 503),
    openapi_extra={"security": []},
)
def request_password_reset(
    body: EmailRequest, request: Request, service: Service
) -> AcceptedMessage:
    check_identity_limit(request, "reset-request", body.email)
    service.request_password_reset(body.email)
    return AcceptedMessage(
        message="If the account is eligible, password reset instructions will be sent.",
        requestId=request.state.request_id,
    )


@router.post(
    "/password-resets",
    operation_id="resetPasswordWithToken",
    status_code=204,
    responses=responses(204, 400, 401, 415, 422, 429, 500),
    openapi_extra={"security": []},
)
def reset_password_with_token(
    body: PasswordResetRequest, request: Request, service: Service
) -> Response:
    service.reset_password_with_token(body.token, body.newPassword, request.state.request_id)
    return Response(status_code=204)
