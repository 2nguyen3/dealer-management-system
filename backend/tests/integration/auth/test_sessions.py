from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.exceptions import AuthError
from app.modules.auth.models import AuthToken
from app.modules.auth.service import AuthService, invalidate_user_sessions
from app.modules.auth.tokens import digest_opaque_token
from app.modules.users.models import AppUser

pytestmark = pytest.mark.integration


def test_login_rotation_logout(session, user, settings, delivery):
    service = AuthService(session, settings, delivery)
    first = service.login("EMPLOYEE@example.COM", "old password")
    other = service.login("employee@example.com", "old password")
    principal = service.authenticate(first.accessToken)
    assert first.user.id == str(user)
    token = session.scalar(
        select(AuthToken).where(AuthToken.token_digest == digest_opaque_token(first.refreshToken))
    )
    sid, expiry = token.session_id, token.expires_at
    assert token.auth_version == 1 and token.revoked_at is None
    assert len(token.token_digest) == 32
    second = service.refresh_tokens(first.refreshToken)
    assert second.refreshToken != first.refreshToken and second.refreshExpiresAt == expiry
    assert service.authenticate(first.accessToken).session_id == sid
    with pytest.raises(AuthError) as caught:
        service.refresh_tokens(first.refreshToken)
    assert caught.value.status == 401
    service.logout(first.refreshToken)  # Consumed ancestor still identifies lineage.
    revoked = session.scalar(
        select(AuthToken.revoked_at)
        .where(AuthToken.session_id == sid, AuthToken.revoked_at.is_not(None))
        .order_by(AuthToken.id.desc())
    )
    service.logout(first.refreshToken)
    assert (
        session.scalar(
            select(AuthToken.revoked_at)
            .where(AuthToken.session_id == sid)
            .order_by(AuthToken.id.desc())
        )
        == revoked
    )
    service.logout("unknown")
    with pytest.raises(AuthError):
        service.authenticate(second.accessToken)
    assert service.authenticate(other.accessToken).user_id == user
    assert service.get_current_user(service.authenticate(other.accessToken)).allowedFunctions
    assert principal.user_id == user


@pytest.mark.parametrize(
    "email,password,status",
    [("missing@example.com", "old password", 401), ("employee@example.com", "wrong", 401)],
)
def test_invalid_login_no_issuance(session, user, settings, delivery, email, password, status):
    service = AuthService(session, settings, delivery)
    with pytest.raises(AuthError) as caught:
        service.login(email, password)
    assert caught.value.status == status
    assert not list(session.scalars(select(AuthToken)))


def test_locked_and_direct_version_invalidation(session, user, settings, delivery):
    service = AuthService(session, settings, delivery)
    issued = service.login("employee@example.com", "old password")
    session.execute(text("UPDATE dms.app_user SET status='LOCKED' WHERE id=:id"), {"id": user})
    session.commit()
    for call in (
        lambda: service.login("employee@example.com", "old password"),
        lambda: service.refresh_tokens(issued.refreshToken),
        lambda: service.authenticate(issued.accessToken),
    ):
        with pytest.raises(AuthError) as caught:
            call()
        assert caught.value.status == 403
    session.execute(text("UPDATE dms.app_user SET status='ACTIVE' WHERE id=:id"), {"id": user})
    session.commit()
    with pytest.raises(AuthError):
        service.refresh_tokens(issued.refreshToken)
    with pytest.raises(AuthError):
        service.authenticate(issued.accessToken)
    assert session.get(AppUser, user).auth_version == 3


def test_expiry_and_cross_purpose(session, user, settings, delivery):
    service = AuthService(session, settings, delivery)
    issued = service.login("employee@example.com", "old password")
    service.request_password_reset("employee@example.com")
    reset = delivery.messages[-1][1]
    with pytest.raises(AuthError):
        service.refresh_tokens(reset)
    service.logout(reset)
    with pytest.raises(AuthError):
        service.reset_password_with_token(issued.refreshToken, "new", "request")
    service.clock = lambda: issued.refreshExpiresAt
    with pytest.raises(AuthError):
        service.refresh_tokens(issued.refreshToken)
    with pytest.raises(AuthError):
        service.authenticate(issued.accessToken)
    service.logout(issued.refreshToken)


def test_fractional_refresh_failure_preserves_original(engine, session, user, settings, delivery):
    service = AuthService(session, settings, delivery)
    issued = service.login("employee@example.com", "old password")
    service.clock = lambda: (
        issued.refreshExpiresAt.replace(microsecond=0) + timedelta(microseconds=1)
    )
    with pytest.raises(AuthError):
        service.refresh_tokens(issued.refreshToken)
    with Session(engine) as check:
        tokens = list(check.scalars(select(AuthToken)))
        assert len(tokens) == 1 and tokens[0].revoked_at is None


@pytest.mark.parametrize("method", ["insert_token", "commit", "flush", "sign"])
def test_rotation_failure_rolls_back(engine, session, user, settings, delivery, method):
    service = AuthService(session, settings, delivery)
    issued = service.login("employee@example.com", "old password")
    if method == "sign":
        target = patch(
            "app.modules.auth.service.encode_access_token", side_effect=RuntimeError("secret")
        )
    elif method == "insert_token":
        target = patch.object(service.repo, method, side_effect=RuntimeError("secret"))
    else:
        target = patch.object(session, method, side_effect=RuntimeError("secret"))
    with target, pytest.raises(RuntimeError):
        service.refresh_tokens(issued.refreshToken)
    with Session(engine) as check:
        tokens = list(check.scalars(select(AuthToken)))
        assert len(tokens) == 1 and tokens[0].revoked_at is None
    assert service.refresh_tokens(issued.refreshToken)


def test_repository_queries_and_caller_owned_invalidation(session, user, settings, delivery):
    service = AuthService(session, settings, delivery)
    issued = service.login("employee@example.com", "old password")
    repo = service.repo
    assert repo.find_user_by_email("' OR 1=1 --") is None
    assert repo.find_user_by_email("EMPLOYEE@EXAMPLE.COM").id == user
    assert repo.get_user_with_group(-1) is None
    assert repo.lock_user(-1) is None
    assert repo.lock_token(user, b"x" * 32, "REFRESH") is None
    repo.revoke_user_tokens(user, (), datetime.now(UTC))
    invalidate_user_sessions(session, user, datetime.now(UTC))
    session.rollback()
    assert service.authenticate(issued.accessToken)
    session.execute(
        text(
            'UPDATE dms.app_user SET "groupId"='
            "(SELECT id FROM dms.user_group WHERE code='SALES') WHERE id=:id"
        ),
        {"id": user},
    )
    invalidate_user_sessions(session, user, datetime.now(UTC))
    session.commit()
    with pytest.raises(AuthError):
        service.refresh_tokens(issued.refreshToken)


def test_password_change_persisted_and_audited(engine, session, user, settings, delivery):
    service = AuthService(session, settings, delivery)
    issued = service.login("employee@example.com", "old password")
    service.request_password_reset("employee@example.com")
    principal = service.authenticate(issued.accessToken)
    with pytest.raises(AuthError):
        service.change_password(principal, "wrong", "new", "wrong-request")
    service.change_password(principal, "old password", " ", "self-change-request")
    with Session(engine) as check:
        assert check.get(AppUser, user).auth_version == 2
        assert all(t.revoked_at is not None for t in check.scalars(select(AuthToken)))
        audit = check.execute(
            text(
                'SELECT "actorType", "actorId", "functionCode", "newData" FROM dms.audit_log '
                "WHERE \"requestId\"='self-change-request'"
            )
        ).one()
        assert audit[:3] == ("USER", user, "users.manage")
        assert "passwordHash" not in audit[3]
    with pytest.raises(AuthError):
        service.authenticate(issued.accessToken)
    with pytest.raises(AuthError):
        service.reset_password_with_token(delivery.messages[-1][1], "new", "request")
    assert service.login("employee@example.com", " ")


def test_reset_once_and_send_failure_compensation(session, user, settings, delivery, caplog):
    service = AuthService(session, settings, delivery)
    issued = service.login("employee@example.com", "old password")
    service.request_password_reset("EMPLOYEE@example.com")
    recipient, old = delivery.messages[-1]
    assert recipient == "Employee@example.com"
    service.request_password_reset("employee@example.com")
    with pytest.raises(AuthError):
        service.reset_password_with_token(old, "new", "old-request")
    raw = delivery.messages[-1][1]
    service.reset_password_with_token(raw, "new", "reset-request")
    with pytest.raises(AuthError):
        service.reset_password_with_token(raw, "again", "request")
    with pytest.raises(AuthError):
        service.authenticate(issued.accessToken)
    assert service.login("employee@example.com", "new")
    audit = session.execute(
        text('SELECT "actorType", "actorId" FROM dms.audit_log WHERE "requestId"=\'reset-request\'')
    ).one()
    assert audit == ("SYSTEM", None)
    delivery.failure = True
    service.request_password_reset("employee@example.com")
    assert all(
        t.revoked_at is not None
        for t in session.scalars(select(AuthToken).where(AuthToken.purpose == "PASSWORD_RESET"))
    )
    assert "secret-delivery-sentinel" not in caplog.text


def test_locked_reset_stays_locked(session, user, settings, delivery):
    service = AuthService(session, settings, delivery)
    session.execute(text("UPDATE dms.app_user SET status='LOCKED' WHERE id=:id"), {"id": user})
    account = service.repo.lock_user(user)
    raw = "current-version-reset"
    service.repo.insert_token(
        account,
        "PASSWORD_RESET",
        digest_opaque_token(raw),
        datetime.now(UTC) + timedelta(minutes=30),
        None,
    )
    session.commit()
    service.reset_password_with_token(raw, "new", "request")
    assert session.get(AppUser, user).status == "LOCKED"
    service.request_password_reset("employee@example.com")
    service.request_password_reset("missing@example.com")
    assert not delivery.messages
    delivery.enabled = False
    with pytest.raises(AuthError) as caught:
        service.request_password_reset("missing@example.com")
    assert caught.value.status == 503


def test_same_password_change_and_expired_reset(session, user, settings, delivery):
    service = AuthService(session, settings, delivery)
    issued = service.login("employee@example.com", "old password")
    original_hash = session.get(AppUser, user).password_hash
    service.change_password(
        service.authenticate(issued.accessToken), "old password", "old password", "same-password"
    )
    account = session.get(AppUser, user)
    assert account.auth_version == 2 and account.password_hash != original_hash
    service.request_password_reset("employee@example.com")
    raw = delivery.messages[-1][1]
    token = service.repo.lock_token(user, digest_opaque_token(raw), "PASSWORD_RESET")
    expiry = token.expires_at
    session.rollback()
    service.clock = lambda: expiry
    with pytest.raises(AuthError):
        service.reset_password_with_token(raw, "new", "expired-reset")
    assert session.get(AppUser, user).auth_version == 2


@pytest.mark.parametrize("workflow", ["change", "reset", "request", "login", "logout"])
def test_write_commit_failure_restores_state(engine, session, user, settings, delivery, workflow):
    service = AuthService(session, settings, delivery)
    issued = service.login("employee@example.com", "old password")
    service.request_password_reset("employee@example.com")
    principal = service.authenticate(issued.accessToken)
    calls = {
        "change": lambda: service.change_password(
            principal, "old password", "new", "failed-request"
        ),
        "reset": lambda: service.reset_password_with_token(
            delivery.messages[-1][1], "new", "failed-request"
        ),
        "request": lambda: service.request_password_reset("employee@example.com"),
        "login": lambda: service.login("employee@example.com", "old password"),
        "logout": lambda: service.logout(issued.refreshToken),
    }
    with (
        patch.object(session, "commit", side_effect=RuntimeError("secret")),
        pytest.raises(RuntimeError),
    ):
        calls[workflow]()
    with Session(engine) as check:
        assert check.get(AppUser, user).auth_version == 1
        assert all(t.revoked_at is None for t in check.scalars(select(AuthToken)))
        assert not check.scalar(
            text("SELECT EXISTS (SELECT 1 FROM dms.audit_log WHERE \"requestId\"='failed-request')")
        )
    assert service.authenticate(issued.accessToken)
