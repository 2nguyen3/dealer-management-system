import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import UTC, datetime

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.exceptions import AuthError
from app.modules.auth.models import AuthToken
from app.modules.auth.service import AuthService, invalidate_user_sessions
from app.modules.users.models import AppUser
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


@contextmanager
def locked_race(engine, settings, delivery):
    with Session(engine) as first_session, Session(engine) as second_session:
        first = AuthService(first_session, settings, delivery)
        second = AuthService(second_session, settings, delivery)
        acquired, release, waiting = threading.Event(), threading.Event(), threading.Event()
        first_lock, second_lock = first.repo.lock_user, second.repo.lock_user

        def hold(user_id):
            user = first_lock(user_id)
            acquired.set()
            assert release.wait(race_timeout(5)), "Race test did not release winner lock"
            return user

        def wait(user_id):
            waiting.set()
            return second_lock(user_id)

        first.repo.lock_user = hold
        second.repo.lock_user = wait
        with ThreadPoolExecutor(max_workers=2) as pool:
            yield first, second, pool, acquired, release, waiting


def outcome(future):
    try:
        return future.result(timeout=race_timeout(10))
    except AuthError as error:
        return error.status


def test_two_refreshes_one_winner(engine, session, user, settings, delivery):
    original = AuthService(session, settings, delivery).login(
        "employee@example.com", "old password"
    )
    with locked_race(engine, settings, delivery) as (
        first,
        second,
        pool,
        acquired,
        release,
        waiting,
    ):
        winner = pool.submit(first.refresh_tokens, original.refreshToken)
        assert acquired.wait(race_timeout(5))
        loser = pool.submit(second.refresh_tokens, original.refreshToken)
        assert waiting.wait(race_timeout(5))
        release.set()
        result = outcome(winner)
        assert outcome(loser) == 401
    with Session(engine) as check:
        tokens = list(check.scalars(select(AuthToken)))
        assert len(tokens) == 2 and sum(t.revoked_at is None for t in tokens) == 1
        assert AuthService(check, settings, delivery).authenticate(result.accessToken)


@pytest.mark.parametrize("winner_action", ["refresh", "logout"])
def test_refresh_logout_both_lock_orders(engine, session, user, settings, delivery, winner_action):
    service = AuthService(session, settings, delivery)
    original = service.login("employee@example.com", "old password")
    unrelated = service.login("employee@example.com", "old password")
    with locked_race(engine, settings, delivery) as (
        first,
        second,
        pool,
        acquired,
        release,
        waiting,
    ):
        first_call = first.refresh_tokens if winner_action == "refresh" else first.logout
        second_call = second.logout if winner_action == "refresh" else second.refresh_tokens
        winner = pool.submit(first_call, original.refreshToken)
        assert acquired.wait(race_timeout(5))
        loser = pool.submit(second_call, original.refreshToken)
        assert waiting.wait(race_timeout(5))
        release.set()
        outcome(winner)
        loser_result = outcome(loser)
        if winner_action == "logout":
            assert loser_result == 401
    with Session(engine) as check:
        service = AuthService(check, settings, delivery)
        with pytest.raises(AuthError):
            service.authenticate(original.accessToken)
        assert service.authenticate(unrelated.accessToken)
        assert check.scalar(
            select(AuthToken).where(
                AuthToken.session_id == service.authenticate(unrelated.accessToken).session_id,
                AuthToken.revoked_at.is_(None),
            )
        )


def test_reset_single_consumer(engine, session, user, settings, delivery):
    service = AuthService(session, settings, delivery)
    original = service.login("employee@example.com", "old password")
    service.request_password_reset("employee@example.com")
    raw = delivery.messages[-1][1]
    with locked_race(engine, settings, delivery) as (
        first,
        second,
        pool,
        acquired,
        release,
        waiting,
    ):
        winner = pool.submit(first.reset_password_with_token, raw, "winner", "winner-request")
        assert acquired.wait(race_timeout(5))
        loser = pool.submit(second.reset_password_with_token, raw, "loser", "loser-request")
        assert waiting.wait(race_timeout(5))
        release.set()
        assert outcome(winner) is None and outcome(loser) == 401
    with Session(engine) as check:
        assert check.get(AppUser, user).auth_version == 2
        service = AuthService(check, settings, delivery)
        assert service.login("employee@example.com", "winner")
        with pytest.raises(AuthError):
            service.authenticate(original.accessToken)


@pytest.mark.parametrize("update", ["password", "group", "status"])
@pytest.mark.parametrize("action", ["login", "refresh"])
def test_update_first_cannot_issue_stale_session(
    engine, session, user, settings, delivery, update, action
):
    service = AuthService(session, settings, delivery)
    original = service.login("employee@example.com", "old password")
    session.rollback()
    with (
        Session(engine) as writer,
        Session(engine) as reader,
        ThreadPoolExecutor(max_workers=1) as pool,
    ):
        account = writer.get(AppUser, user, with_for_update=True)
        blocked = AuthService(reader, settings, delivery)
        # Deliberately put the old user into the SQLAlchemy identity map.
        cached = blocked.repo.find_user_by_email("employee@example.com")
        assert cached.auth_version == 1
        lock = blocked.repo.lock_user
        waiting = threading.Event()

        def announced_lock(identifier):
            waiting.set()
            return lock(identifier)

        blocked.repo.lock_user = announced_lock
        call = (
            (lambda: blocked.login("employee@example.com", "old password"))
            if action == "login"
            else (lambda: blocked.refresh_tokens(original.refreshToken))
        )
        result = pool.submit(call)
        assert waiting.wait(race_timeout(5))
        if update == "password":
            from app.core.security import hash_password

            account.password_hash = hash_password("new password")
        elif update == "group":
            account.group_id = writer.scalar(
                text("SELECT id FROM dms.user_group WHERE code='SALES'")
            )
        else:
            account.status = "LOCKED"
        writer.flush()
        invalidate_user_sessions(writer, user, datetime.now(UTC))
        writer.commit()
        assert outcome(result) in (401, 403)
    with Session(engine) as check:
        assert not list(check.scalars(select(AuthToken).where(AuthToken.revoked_at.is_(None))))


@pytest.mark.parametrize("first_action", ["reset", "change"])
def test_password_change_reset_serialization(
    engine, session, user, settings, delivery, first_action
):
    service = AuthService(session, settings, delivery)
    original = service.login("employee@example.com", "old password")
    principal = service.authenticate(original.accessToken)
    service.request_password_reset("employee@example.com")
    raw = delivery.messages[-1][1]
    session.rollback()
    with locked_race(engine, settings, delivery) as (
        first,
        second,
        pool,
        acquired,
        release,
        waiting,
    ):

        def reset_call():
            return first.reset_password_with_token(raw, "winner", "winner-request")

        def change_call():
            return first.change_password(principal, "old password", "winner", "winner-request")

        winner = pool.submit(reset_call if first_action == "reset" else change_call)
        assert acquired.wait(race_timeout(5))
        loser_call = (
            (lambda: second.change_password(principal, "old password", "loser", "loser-request"))
            if first_action == "reset"
            else (lambda: second.reset_password_with_token(raw, "loser", "loser-request"))
        )
        loser = pool.submit(loser_call)
        assert waiting.wait(race_timeout(5))
        release.set()
        assert outcome(winner) is None and outcome(loser) == 401
    with Session(engine) as check:
        assert check.get(AppUser, user).auth_version == 2
        assert all(t.revoked_at is not None for t in check.scalars(select(AuthToken)))


def test_two_reset_requests_only_latest_is_live(engine, session, user, settings, delivery):
    with locked_race(engine, settings, delivery) as (
        first,
        second,
        pool,
        acquired,
        release,
        waiting,
    ):
        winner = pool.submit(first.request_password_reset, "employee@example.com")
        assert acquired.wait(race_timeout(5))
        loser = pool.submit(second.request_password_reset, "employee@example.com")
        assert waiting.wait(race_timeout(5))
        release.set()
        assert outcome(winner) is None and outcome(loser) is None
    with Session(engine) as check:
        resets = list(check.scalars(select(AuthToken)))
        assert len(resets) == 2 and sum(t.revoked_at is None for t in resets) == 1
