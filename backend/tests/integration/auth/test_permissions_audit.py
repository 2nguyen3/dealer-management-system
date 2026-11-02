from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AuthError
from app.core.request_context import set_audit_context
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService
from app.modules.users.models import AppUser

pytestmark = pytest.mark.integration


@pytest.mark.parametrize(
    "group,allowed,denied",
    [
        ("SALES", "stock.issue.prepare", "stock.issue.post"),
        ("WAREHOUSE", "stock.issue.post", "cash.receipt.post"),
        ("ACCOUNTING", "cash.receipt.post", "stock.issue.post"),
        ("MANAGEMENT", "users.manage", None),
    ],
)
def test_initial_group_permissions_are_data(
    engine, user, settings, delivery, group, allowed, denied
):
    with Session(engine) as session:
        account = session.get(AppUser, user)
        account.group_id = session.scalar(
            text("SELECT id FROM dms.user_group WHERE code=:code"), {"code": group}
        )
        session.commit()
        service = AuthService(session, settings, delivery)
        issued = service.login("employee@example.com", "old password")
        principal = service.authenticate(issued.accessToken)
        grants = service.get_current_user(principal).allowedFunctions
        assert allowed in grants
        assert require_permissions(all_of=(allowed,))(principal, service) is principal
        if denied:
            assert denied not in grants
            with pytest.raises(AuthError) as caught:
                require_permissions(all_of=(denied,))(principal, service)
            assert caught.value.status == 403
        session.execute(
            text('UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=:group'),
            {"group": account.group_id},
        )
        session.commit()
        assert service.get_current_user(principal).allowedFunctions == []
        with pytest.raises(AuthError):
            require_permissions(all_of=(allowed,))(principal, service)
        assert service.authenticate(issued.accessToken)


def test_audit_context_clears_actor_and_does_not_leak(engine, user, settings, delivery):
    with Session(engine) as session:
        set_audit_context(session, user, "prior-user-context")
        set_audit_context(session, None, "system-context")
        account = AuthRepository(session).lock_user(user)
        account.full_name = "System Updated Employee"
        session.commit()
        audit = session.execute(
            text(
                'SELECT "actorType", "actorId", "functionCode", "requestId" FROM dms.audit_log '
                "WHERE \"requestId\"='system-context'"
            )
        ).one()
        assert audit == ("SYSTEM", None, "users.manage", "system-context")
        session.rollback()
        context = session.execute(
            text(
                "SELECT nullif(current_setting('dms.actor_id', true), ''), "
                "nullif(current_setting('dms.request_id', true), '')"
            )
        ).one()
        assert context == (None, None)
    with engine.connect() as connection:
        assert connection.execute(
            text(
                "SELECT nullif(current_setting('dms.actor_id', true), ''), "
                "nullif(current_setting('dms.request_id', true), '')"
            )
        ).one() == (None, None)


def test_direct_sql_hash_group_and_profile_semantics(session, user, settings, delivery):
    service = AuthService(session, settings, delivery)
    original = service.login("employee@example.com", "old password")
    service.request_password_reset("employee@example.com")
    session.execute(
        text(
            "UPDATE dms.app_user SET \"fullName\"='New Profile', "
            "email='changed@example.com' WHERE id=:id"
        ),
        {"id": user},
    )
    session.commit()
    assert session.get(AppUser, user).auth_version == 1
    assert (
        service.get_current_user(service.authenticate(original.accessToken)).user.fullName
        == "New Profile"
    )
    session.execute(
        text("UPDATE dms.app_user SET \"passwordHash\"='invalid-new-hash' WHERE id=:id"),
        {"id": user},
    )
    session.commit()
    assert session.get(AppUser, user).auth_version == 2
    for call in (
        lambda: service.authenticate(original.accessToken),
        lambda: service.refresh_tokens(original.refreshToken),
        lambda: service.reset_password_with_token(delivery.messages[-1][1], "new", "request"),
    ):
        with pytest.raises(AuthError):
            call()
    with pytest.raises(IntegrityError):
        session.execute(text('UPDATE dms.app_user SET "authVersion"=1 WHERE id=:id'), {"id": user})
    session.rollback()
    assert session.get(AppUser, user).auth_version == 2


def test_case_insensitive_uniqueness_and_missing_grants(session, user, settings, delivery):
    with pytest.raises(IntegrityError):
        session.execute(
            text(
                'INSERT INTO dms.app_user ("fullName",email,"passwordHash","groupId") '
                'SELECT \'Duplicate\',upper(email),"passwordHash","groupId" '
                "FROM dms.app_user WHERE id=:id"
            ),
            {"id": user},
        )
    session.rollback()
    service = AuthService(session, settings, delivery)
    issued = service.login("employee@example.com", "old password")
    session.execute(text('DELETE FROM dms.group_permission WHERE "groupId"=1'))
    assert service.get_current_user(service.authenticate(issued.accessToken)).allowedFunctions == []
    session.rollback()


def test_reset_delivery_runs_after_commit_and_compensation_persists(
    engine, session, user, settings, delivery
):
    service = AuthService(session, settings, delivery)

    def delivery_outside_transaction(recipient, raw):
        with Session(engine) as other:
            other.execute(text("SET LOCAL lock_timeout='500ms'"))
            account = AuthRepository(other).lock_user(user)
            assert account.id == user
            assert not session.in_transaction()
        raise RuntimeError("secret-sentinel")

    with patch.object(delivery, "send", side_effect=delivery_outside_transaction):
        service.request_password_reset("employee@example.com")
    with engine.connect() as check:
        assert (
            check.scalar(text('SELECT count(*) FROM dms.auth_token WHERE "revokedAt" IS NOT NULL'))
            == 1
        )
