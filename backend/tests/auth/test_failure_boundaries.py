from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import jwt
import pytest
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.common.responses import validation_error_handler
from app.core.exceptions import AuthError
from app.core.request_context import request_context
from app.modules.auth.service import AuthService
from app.modules.auth.tokens import decode_access_token, encode_access_token


@pytest.mark.parametrize("header", [{"kid": "unexpected"}, {"alg": "none"}])
def test_jwt_header_rejected(settings, header):
    raw = jwt.encode(
        {},
        settings.auth_signing_key.get_secret_value() if header.get("alg") != "none" else None,
        algorithm=header.get("alg", "HS256"),
        headers=header,
    )
    with pytest.raises(AuthError):
        decode_access_token(settings, raw, datetime.now(UTC))


def test_jwt_missing_future_and_wrong_key(settings):
    now = datetime.now(UTC)
    raw, _ = encode_access_token(
        settings, 1, uuid4(), 1, now + timedelta(days=1), now + timedelta(minutes=1)
    )
    with pytest.raises(AuthError):
        decode_access_token(settings, raw, now)
    with pytest.raises(AuthError):
        decode_access_token(
            settings,
            jwt.encode({}, settings.auth_signing_key.get_secret_value(), algorithm="HS256"),
            now,
        )
    raw, _ = encode_access_token(settings, 1, uuid4(), 1, now + timedelta(days=1), now)
    with pytest.raises(AuthError):
        decode_access_token(
            settings.model_copy(update={"auth_signing_key": settings.smtp_password}), raw, now
        )


@pytest.mark.anyio
async def test_non_auth_validation_keeps_fastapi_payload():
    request = Request({"type": "http", "path": "/other", "headers": [], "query_string": b""})
    response = await validation_error_handler(
        request,
        RequestValidationError(
            [{"type": "missing", "loc": ("body", "name"), "msg": "Field required"}]
        ),
    )
    assert response.status_code == 422 and b"detail" in response.body


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_non_auth_unexpected_failure_not_translated():
    app = FastAPI()
    app.middleware("http")(request_context)

    @app.get("/other")
    def broken():
        raise RuntimeError("health failure")

    with TestClient(app) as client, pytest.raises(RuntimeError, match="health failure"):
        client.get("/other")


@pytest.mark.parametrize("point", ["token_disappeared", "projection_unavailable"])
def test_issuance_fails_closed_and_rolls_back(settings, point):
    session, delivery = Mock(), Mock()
    service = AuthService(session, settings, delivery)
    service.repo = Mock()
    user = SimpleNamespace(id=1, status="ACTIVE", auth_version=1)
    token = SimpleNamespace(
        session_id=uuid4(),
        expires_at=datetime.now(UTC) + timedelta(days=1),
        revoked_at=None,
        auth_version=1,
    )
    service.repo.find_token_owner.return_value = 1
    service.repo.lock_user.return_value = user
    service.repo.lock_token.return_value = None if point == "token_disappeared" else token
    service.repo.get_user_with_group.return_value = None
    with pytest.raises(AuthError):
        service.refresh_tokens("opaque")
    session.commit.assert_not_called()
    session.rollback.assert_called_once()


def test_logout_owner_or_token_removed_is_idempotent(settings):
    for user, token in ((None, None), (SimpleNamespace(id=1), None)):
        session = Mock()
        service = AuthService(session, settings, Mock())
        service.repo = Mock()
        service.repo.find_token_owner.return_value = 1
        service.repo.lock_user.return_value = user
        service.repo.lock_token.return_value = token
        service.logout("unknown")
        service.repo.revoke_session.assert_not_called()
        session.commit.assert_called_once()


def test_reset_compensation_failure_and_already_revoked(settings, caplog):
    for token in (None, SimpleNamespace(id=2, revoked_at=datetime.now(UTC))):
        session, delivery = Mock(), Mock()
        service = AuthService(session, settings, delivery, sleeper=Mock())
        service.repo = Mock()
        user = SimpleNamespace(id=1, email="employee@example.com", status="ACTIVE", auth_version=1)
        service.repo.find_user_by_email.return_value = user
        service.repo.lock_user.return_value = user
        service.repo.insert_token.return_value = SimpleNamespace(id=2)
        service.repo.lock_token.return_value = token
        delivery.send.side_effect = RuntimeError("credential-sentinel")
        service.request_password_reset("employee@example.com")
        assert "credential-sentinel" not in caplog.text
    service.repo.lock_token.side_effect = RuntimeError("credential-sentinel")
    service.request_password_reset("employee@example.com")
    assert "compensation failed" in caplog.text
    assert "credential-sentinel" not in caplog.text


def test_live_version_recheck_and_missing_projection(settings):
    session = Mock()
    service = AuthService(session, settings, Mock())
    service.repo = Mock()
    user = SimpleNamespace(id=1, status="ACTIVE", auth_version=2)
    token = SimpleNamespace(
        revoked_at=None, expires_at=datetime.now(UTC) + timedelta(days=1), auth_version=2
    )
    service.repo.get_user_with_group.return_value = (user, Mock())
    service.repo.live_session.return_value = token
    claims = {
        "sub": "1",
        "sid": str(uuid4()),
        "ver": 1,
        "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
    }
    with pytest.raises(AuthError):
        service.authenticate_claims(claims)
    claims["ver"] = 2
    principal = service.authenticate_claims(claims)
    service.repo.get_user_with_group.side_effect = [(user, Mock()), None]
    with pytest.raises(AuthError):
        service.get_current_user(principal)


def test_crypto_resource_failure_propagates(settings):
    from app.core.security import hash_password, verify_password
    from app.modules.auth.tokens import generate_opaque_token

    with (
        patch("app.core.security.PasswordHasher.hash", side_effect=MemoryError),
        pytest.raises(MemoryError),
    ):
        hash_password("x")
    with (
        patch("app.core.security.PasswordHasher.verify", side_effect=MemoryError),
        pytest.raises(MemoryError),
    ):
        verify_password("x", "hash")
    with (
        patch("app.modules.auth.tokens.secrets.token_urlsafe", side_effect=OSError),
        pytest.raises(OSError),
    ):
        generate_opaque_token()
