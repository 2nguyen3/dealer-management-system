from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.common.commands import (
    CommandRepository,
    CommandResult,
    CommandScope,
    internal_substep_key,
    request_fingerprint,
)
from app.common.preconditions import canonical_etag, parse_preconditions
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.modules.users.models import AppUser
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def authorize(session, actor):
    user = session.execute(
        text("SELECT status FROM dms.app_user WHERE id=:id FOR UPDATE"), {"id": actor}
    ).one()
    if user.status != "ACTIVE":
        raise ApiError(403, "ACCOUNT_LOCKED", "Account locked")


def increment(session, command):
    session.execute(text("UPDATE dms.probe SET value=value+1 WHERE id=1"))
    return lambda: CommandResult(
        status=200, body={"value": session.scalar(text("SELECT value FROM dms.probe WHERE id=1"))}
    )


def test_command_replay_scope_conflict_and_revocation(engine, actor):
    scope = CommandScope(actor, "probeUpdate", "probe:1", uuid4())
    with Session(engine) as session:
        runner = TransactionRunner(session)
        expected = runner.run(
            scope,
            {"amount": "1"},
            authorize=lambda: authorize(session, actor),
            work=lambda cmd: increment(session, cmd),
        )
        assert expected.body == {"value": 1}
    with Session(engine) as session:
        repo = CommandRepository(session)
        saved = repo.find(scope)
        assert saved.state == "COMPLETED" and saved.updated_at >= saved.created_at
        assert saved.request_digest == request_fingerprint({"amount": "1"})
        result = TransactionRunner(session).run(
            scope,
            {"amount": "1"},
            authorize=lambda: authorize(session, actor),
            work=lambda _: pytest.fail("replay executed work"),
        )
        assert result == expected
        with pytest.raises(ApiError, match="IDEMPOTENCY_KEY_REUSED"):
            TransactionRunner(session).run(
                scope,
                {"amount": "2"},
                authorize=lambda: authorize(session, actor),
                work=lambda cmd: increment(session, cmd),
            )
        for scoped in (
            replace(scope, operation_id="otherUpdate"),
            replace(scope, resource_scope="probe:2"),
        ):
            TransactionRunner(session).run(
                scoped,
                {},
                authorize=lambda: authorize(session, actor),
                work=lambda cmd: increment(session, cmd),
            )
        assert session.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == 3
        assert session.scalar(text("SELECT value FROM dms.probe WHERE id=1")) == 3
        session.execute(text("UPDATE dms.app_user SET status='LOCKED' WHERE id=:id"), {"id": actor})
        session.commit()
        with pytest.raises(ApiError, match="ACCOUNT_LOCKED"):
            TransactionRunner(session).run(
                scope,
                {"amount": "1"},
                authorize=lambda: authorize(session, actor),
                work=lambda cmd: increment(session, cmd),
            )


@pytest.mark.parametrize("failure", ["mid_write", "deferred", "projection", "commit"])
def test_failure_rolls_back_command_domain_and_audit(engine, actor, failure):
    scope = CommandScope(actor, "probeUpdate", "probe:1", uuid4())
    with Session(engine) as session:

        def work(command):
            set_audit_context(session, actor, "probe-request", function_code="district.manage")
            session.execute(
                text("INSERT INTO dms.district (code,name) VALUES ('ROLLBACK','Rollback')")
            )
            project = increment(session, command)
            if failure == "mid_write":
                raise RuntimeError("injected")
            if failure == "deferred":
                session.execute(text("INSERT INTO dms.probe_child VALUES (1,999)"))
            if failure == "projection":
                return lambda: CommandResult(status=200, body={"password": "sentinel"})
            return project

        with (
            patch.object(session, "commit", side_effect=RuntimeError("injected"))
            if failure == "commit"
            else patch.object(session, "commit", wraps=session.commit)
        ):
            with pytest.raises((ApiError, RuntimeError, ValueError)):
                TransactionRunner(session).run(
                    scope, {}, authorize=lambda: authorize(session, actor), work=work
                )
        assert session.scalar(text("SELECT value FROM dms.probe WHERE id=1")) == 0
        assert session.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == 0
        assert session.scalar(text("SELECT count(*) FROM dms.district WHERE code='ROLLBACK'")) == 0
        assert (
            session.scalar(
                text("SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='probe-request'")
            )
            == 0
        )
        assert TransactionRunner(session).run(
            scope,
            {},
            authorize=lambda: authorize(session, actor),
            work=lambda cmd: increment(session, cmd),
        ).body == {"value": 1}


def test_concurrent_matching_and_changed_payload(engine, actor):
    scope = CommandScope(actor, "probeUpdate", "probe:1", uuid4())
    barrier = Barrier(2)

    def execute(payload):
        with Session(engine) as session:
            barrier.wait(timeout=race_timeout(10))
            try:
                return TransactionRunner(session).run(
                    scope, payload, authorize=lambda: None, work=lambda cmd: increment(session, cmd)
                )
            except ApiError as error:
                return error

    with ThreadPoolExecutor(2) as pool:
        futures = [pool.submit(execute, {}) for _ in range(2)]
        results = [future.result(timeout=race_timeout(20)) for future in futures]
    assert all(item.body == {"value": 1} for item in results)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT value FROM dms.probe WHERE id=1")) == 1
        assert connection.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == 1
    barrier = Barrier(2)
    with ThreadPoolExecutor(2) as pool:
        futures = [pool.submit(execute, {"changed": True}), pool.submit(execute, {})]
        results = [future.result(timeout=race_timeout(20)) for future in futures]
    assert (
        sum(
            isinstance(item, ApiError) and item.code == "IDEMPOTENCY_KEY_REUSED" for item in results
        )
        == 1
    )


def test_etag_lock_one_winner_and_stale_replay(engine, actor):
    with engine.connect() as connection:
        initial = canonical_etag(
            "probe:1", {"value": connection.scalar(text("SELECT value FROM dms.probe WHERE id=1"))}
        )
    barrier = Barrier(2)
    keys = [uuid4(), uuid4()]

    def execute(key):
        with Session(engine) as session:
            barrier.wait(timeout=race_timeout(10))

            def work(command):
                value = session.scalar(text("SELECT value FROM dms.probe WHERE id=1 FOR UPDATE"))
                parse_preconditions(initial).compare(canonical_etag("probe:1", {"value": value}))
                return increment(session, command)

            try:
                return TransactionRunner(session).run(
                    CommandScope(actor, "probeUpdate", "probe:1", key),
                    {},
                    authorize=lambda: None,
                    work=work,
                )
            except ApiError as error:
                return error

    with ThreadPoolExecutor(2) as pool:
        results = [
            future.result(timeout=race_timeout(20))
            for future in [pool.submit(execute, key) for key in keys]
        ]
    assert sum(isinstance(item, ApiError) and item.status == 412 for item in results) == 1
    winner = next(
        key for key, result in zip(keys, results, strict=True) if isinstance(result, CommandResult)
    )
    with Session(engine) as session:
        result = TransactionRunner(session).run(
            CommandScope(actor, "probeUpdate", "probe:1", winner),
            {},
            authorize=lambda: authorize(session, actor),
            work=lambda _: pytest.fail("stale replay checked work"),
        )
        assert result.body == {"value": 1}


def test_repository_no_commit_accepted_and_identity_guard(engine, actor):
    scope = CommandScope(actor, "probeUpdate", "probe:1", uuid4())
    with Session(engine) as session:
        repository = CommandRepository(session)
        assert repository.find(scope) is None
        command, fresh = repository.claim(scope, request_fingerprint({}))
        assert fresh
        repository.complete(
            command,
            CommandResult(status=202, body={"id": "1"}),
            recovery={"resourceId": "1", "step": "providerSetup"},
        )
        assert command.state == "ACCEPTED"
        session.rollback()
    with Session(engine) as session:
        assert CommandRepository(session).find(scope) is None
        command, _ = CommandRepository(session).claim(scope, request_fingerprint({}))
        CommandRepository(session).complete(command, CommandResult(status=204))
        session.commit()
        for mutation in (
            "DELETE FROM dms.api_idempotency",
            "UPDATE dms.api_idempotency SET state='CLAIMED'",
            "UPDATE dms.api_idempotency SET \"operationId\"='changed'",
        ):
            with pytest.raises(IntegrityError):
                session.execute(text(mutation))
            session.rollback()


def test_incomplete_out_of_band_command_fails_closed(engine, actor):
    scope = CommandScope(actor, "probeUpdate", "probe:1", uuid4())
    with Session(engine) as session:
        CommandRepository(session).claim(scope, request_fingerprint({}))
        # Deliberate misuse outside the runner: no domain operation can be replayed.
        session.commit()
        with pytest.raises(ApiError, match="RESOURCE_BUSY"):
            TransactionRunner(session).run(
                scope,
                {},
                authorize=lambda: authorize(session, actor),
                work=lambda _: pytest.fail("unfinished record executed another intent"),
            )
        assert session.scalar(text("SELECT value FROM dms.probe WHERE id=1")) == 0


def test_actor_scope_and_composed_substeps(engine, actor):
    key = uuid4()
    with Session(engine) as session:
        other = AppUser(
            full_name="Other", email="other@example.com", password_hash="hash", group_id=1
        )
        session.add(other)
        session.commit()
        scopes = [
            CommandScope(user_id, "probeCreate", "probe:1", key) for user_id in (actor, other.id)
        ]

        def work(command):
            for step in ("parent", "child"):
                session.execute(
                    text("INSERT INTO dms.probe_keys VALUES (:id)"),
                    {"id": internal_substep_key(command.id, step)},
                )
            return lambda: CommandResult(status=201, body={"id": str(command.id)})

        results = [
            TransactionRunner(session).run(scope, {}, authorize=lambda: None, work=work)
            for scope in scopes
        ]
        assert results[0].body != results[1].body
        assert session.scalar(text("SELECT count(*) FROM dms.probe_keys")) == 4
        assert session.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == 2


def test_accepted_command_reference_survives_restart(engine, actor):
    scope = CommandScope(actor, "probeAccept", "probe:1", uuid4())
    with Session(engine) as session:
        repository = CommandRepository(session)
        command, _ = repository.claim(scope, request_fingerprint({}))
        repository.complete(
            command, CommandResult(status=202, body={"id": "1"}), recovery={"resourceId": "1"}
        )
        session.commit()
    with Session(engine) as session:
        repository = CommandRepository(session)
        command = repository.find(scope)
        assert command.state == "ACCEPTED" and command.recovery == {"resourceId": "1"}
        repository.complete(command, CommandResult(status=200, body={"id": "1", "state": "DONE"}))
        session.commit()
    with Session(engine) as session:
        command = CommandRepository(session).find(scope)
        assert command.state == "COMPLETED" and command.recovery is None


def test_result_projection_after_deferred_refresh(engine, actor):
    scope = CommandScope(actor, "probeCreate", "probe:1", uuid4())
    with Session(engine) as session:

        def work(command):
            session.execute(text("INSERT INTO dms.probe_child VALUES (1,1)"))
            assert session.scalar(text("SELECT value FROM dms.probe WHERE id=1")) == 0
            return lambda: CommandResult(
                status=200,
                body={"value": session.scalar(text("SELECT value FROM dms.probe WHERE id=1"))},
            )

        result = TransactionRunner(session).run(scope, {}, authorize=lambda: None, work=work)
        assert result.body == {"value": 1}


@pytest.mark.parametrize(
    "statement,constraint",
    [
        ("INSERT INTO dms.district (code,name) VALUES ('TAKEN','Another')", "district_code_key"),
        ("UPDATE dms.probe SET value=-1 WHERE id=1", "positive_probe"),
        ("INSERT INTO dms.probe_child VALUES (1,999)", "probe_parent"),
    ],
)
def test_operation_constraint_translation_after_rollback(engine, actor, statement, constraint):
    with Session(engine) as session:
        session.execute(text("INSERT INTO dms.district (code,name) VALUES ('TAKEN','Taken')"))
        session.commit()
        scope = CommandScope(actor, "probeUpdate", "probe:1", uuid4())

        def work(command):
            session.execute(text(statement))
            return lambda: CommandResult(status=204)

        state = {"district_code_key": "23505", "positive_probe": "23514", "probe_parent": "23503"}[
            constraint
        ]
        with pytest.raises(ApiError, match="BUSINESS_CONFLICT"):
            TransactionRunner(session).run(
                scope,
                {},
                authorize=lambda: None,
                work=work,
                conflicts={(state, constraint): ("BUSINESS_CONFLICT", "Business conflict")},
            )
        assert session.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == 0
        assert session.scalar(text("SELECT value FROM dms.probe WHERE id=1")) == 0
