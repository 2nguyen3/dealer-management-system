"""Per-request authentication snapshot reuse for read-only requests (AuthService memoize)."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from starlette.requests import Request

from app.core.exceptions import AuthError
from app.modules.auth.dependencies import get_auth_service
from app.modules.auth.service import AuthService

NOW = datetime(2026, 11, 10, 8, 0, tzinfo=UTC)


def make_service(settings, *, memoize, clock=lambda: NOW):
    service = AuthService(Mock(), settings, Mock(), clock=clock, memoize=memoize)
    service.repo = Mock()
    user = SimpleNamespace(
        id=7,
        full_name="Synthetic User",
        email="synthetic@example.com",
        group_id=3,
        status="ACTIVE",
        auth_version=2,
        created_at=NOW,
        updated_at=NOW,
    )
    group = SimpleNamespace(id=3, code="SALES", name="Kinh doanh")
    sid = uuid4()
    service.repo.get_user_with_group.return_value = (user, group)
    service.repo.live_session.return_value = SimpleNamespace(
        revoked_at=None, expires_at=NOW + timedelta(days=1), auth_version=2
    )
    service.repo.get_allowed_function_codes.return_value = ["agency.read", "sales.read"]
    claims = {
        "sub": "7",
        "sid": str(sid),
        "ver": 2,
        "exp": int((NOW + timedelta(minutes=10)).timestamp()),
        "jti": "jti-1",
    }
    return service, claims


def test_memoized_read_reuses_one_snapshot(settings):
    service, claims = make_service(settings, memoize=True)
    principal = service.authenticate_claims(claims)
    assert service.authenticate_claims(claims) is principal
    first = service.get_current_user(principal)
    for _ in range(6):
        again = service.get_current_user(principal)
        assert again == first
        assert again is not first
    # One user/session lookup and one permission lookup for the whole request.
    assert service.repo.get_user_with_group.call_count == 1
    assert service.repo.live_session.call_count == 1
    assert service.repo.get_allowed_function_codes.call_count == 1
    # Mutating a returned copy never leaks into later authorization decisions.
    first.allowedFunctions.append("users.manage")
    assert "users.manage" not in service.get_current_user(principal).allowedFunctions


def test_default_service_stays_live_for_every_check(settings):
    service, claims = make_service(settings, memoize=False)
    principal = service.authenticate_claims(claims)
    service.get_current_user(principal)
    service.get_current_user(principal)
    assert service.repo.live_session.call_count == 3
    assert service.repo.get_user_with_group.call_count == 5
    assert service.repo.get_allowed_function_codes.call_count == 2


def test_memo_never_bypasses_locking_or_failed_authentication(settings):
    service, claims = make_service(settings, memoize=True)
    service.repo.live_session.return_value = None
    with pytest.raises(AuthError):
        service.authenticate_claims(claims)
    assert service._authenticated == {}
    with pytest.raises(AuthError):
        service.authenticate_claims(claims)
    assert service.repo.live_session.call_count == 2

    service, claims = make_service(settings, memoize=True)
    service.repo.lock_user.return_value = service.repo.get_user_with_group.return_value[0]
    service.authenticate_claims(claims, lock=True)
    service.authenticate_claims(claims, lock=True)
    assert service.repo.lock_user.call_count == 2
    assert service._authenticated == {}


def test_memoized_principal_still_expires(settings):
    times = [NOW]
    service, claims = make_service(settings, memoize=True, clock=lambda: times[0])
    service.authenticate_claims(claims)
    times[0] = NOW + timedelta(minutes=10)  # exactly exp: boundary is exclusive
    with pytest.raises(AuthError) as error:
        service.authenticate_claims(claims)
    assert error.value.status == 401


def test_different_token_is_not_served_from_memo(settings):
    service, claims = make_service(settings, memoize=True)
    service.authenticate_claims(claims)
    service.authenticate_claims({**claims, "jti": "jti-2"})
    assert service.repo.live_session.call_count == 2


@pytest.mark.parametrize(
    ("method", "expected"),
    [("GET", True), ("HEAD", True), ("POST", False), ("PATCH", False), ("DELETE", False)],
)
def test_dependency_memoizes_only_safe_methods(settings, method, expected):
    app = FastAPI()
    app.state.settings, app.state.reset_delivery = settings, Mock()
    request = Request({"type": "http", "method": method, "app": app, "headers": []})
    assert get_auth_service(request, Mock()).memoize is expected
