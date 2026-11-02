import time
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Barrier, Event

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import parse_preconditions
from app.core.exceptions import ApiError
from app.modules.user_groups.schemas import GroupCreate, GroupUpdate
from app.modules.user_groups.service import GroupService, group_etag
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def group_service(session, actor):
    return GroupService(session, CursorCodec(b"x" * 32), actor, "race-request", lambda _: None)


def wait_for_blocker(engine, pid):
    deadline = time.monotonic() + race_timeout(3)
    with engine.connect() as connection:
        while time.monotonic() < deadline:
            if connection.scalar(text("SELECT cardinality(pg_blocking_pids(:pid))"), {"pid": pid}):
                return
            Event().wait(0.01)
    pytest.fail("Expected real PostgreSQL lock wait did not occur")


def test_competing_updates_one_current_etag(engine, actor, service):
    group = service.create(GroupCreate(code="TEAM", name="Team"))
    version = group_etag(group)
    barrier = Barrier(2)

    def update(name):
        with Session(engine) as session:
            barrier.wait(timeout=race_timeout(10))
            try:
                return group_service(session, actor).update(
                    group.id, GroupUpdate(name=name), parse_preconditions(version)
                )
            except ApiError as error:
                return error

    with ThreadPoolExecutor(2) as pool:
        results = [
            future.result(timeout=race_timeout(20))
            for future in [pool.submit(update, name) for name in ("One", "Two")]
        ]
    assert sum(isinstance(item, ApiError) and item.status == 412 for item in results) == 1
    assert service.get(group.id).name in ("One", "Two")
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='race-request'")
            )
            == 1
        )


@pytest.mark.parametrize("first", ["delete", "assign"])
def test_assignment_versus_deletion_both_lock_orders(engine, actor, service, first):
    group = service.create(GroupCreate(code="TEAM", name="Team"))
    version = group_etag(group)
    ready, release = Event(), Event()
    waiter = Queue()

    def assign():
        with Session(engine) as session:
            if first == "delete":
                waiter.put(session.scalar(text("SELECT pg_backend_pid()")))
            try:
                session.execute(
                    text(
                        'INSERT INTO dms.app_user ("fullName",email,"passwordHash","groupId") '
                        "VALUES ('Member','member@example.com','hash',:id)"
                    ),
                    {"id": group.id},
                )
                if first == "assign":
                    ready.set()
                    assert release.wait(timeout=race_timeout(10))
                session.commit()
                return "assigned"
            except IntegrityError:
                session.rollback()
                return "reference-rejected"

    def remove():
        with Session(engine) as session:
            use_case = group_service(session, actor)
            if first == "delete":
                use_case.lock(group.id)
                ready.set()
                assert release.wait(timeout=race_timeout(10))
            else:
                waiter.put(session.scalar(text("SELECT pg_backend_pid()")))
            try:
                use_case.delete(group.id, parse_preconditions(version))
                return "deleted"
            except ApiError as error:
                return error.code

    with ThreadPoolExecutor(2) as pool:
        leading = pool.submit(remove if first == "delete" else assign)
        assert ready.wait(timeout=race_timeout(10))
        following = pool.submit(assign if first == "delete" else remove)
        try:
            wait_for_blocker(engine, waiter.get(timeout=race_timeout(10)))
        finally:
            release.set()
        outcomes = (
            leading.result(timeout=race_timeout(20)),
            following.result(timeout=race_timeout(20)),
        )
    if first == "delete":
        assert outcomes == ("deleted", "reference-rejected")
    else:
        # userCount is part of the detail: the committed assignment also makes
        # the original token stale before the reference conflict is checked.
        assert outcomes == ("assigned", "PRECONDITION_FAILED")
        current = service.get(group.id)
        assert current.userCount == 1
        with pytest.raises(ApiError, match="RESOURCE_IN_USE"):
            service.delete(group.id, parse_preconditions(group_etag(current)))


@pytest.mark.parametrize("operation", ["update", "delete"])
def test_committed_grant_revocation_during_target_lock_wait(client, engine, operation):
    created = client.post("/api/v1/user-groups", json={"code": "TARGET", "name": "Target"})
    identifier, path = created.json()["id"], created.headers["Location"]
    with engine.begin() as connection:
        connection.execute(
            text('INSERT INTO dms.group_permission ("groupId","functionId") VALUES (:id,1)'),
            {"id": identifier},
        )
    with Session(engine) as blocker:
        blocker.execute(
            text("SELECT id FROM dms.user_group WHERE id=:id FOR UPDATE"), {"id": identifier}
        )
        with ThreadPoolExecutor(1) as pool:
            if operation == "update":
                pending = pool.submit(
                    client.patch,
                    path,
                    json={"name": "Changed"},
                    headers={"If-Match": created.headers["ETag"]},
                )
            else:
                pending = pool.submit(
                    client.delete, path, headers={"If-Match": created.headers["ETag"]}
                )
            try:
                deadline = time.monotonic() + race_timeout(3)
                with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as observer:
                    while time.monotonic() < deadline:
                        pid = observer.scalar(
                            text(
                                "SELECT pid FROM pg_stat_activity WHERE datname=:db "
                                "AND wait_event_type='Lock' AND query LIKE '%user_group%'"
                            ),
                            {"db": engine.url.database},
                        )
                        if pid:
                            break
                        Event().wait(0.01)
                    else:
                        pytest.fail("HTTP mutation never reached its target lock wait")
                with engine.begin() as connection:
                    connection.exec_driver_sql(
                        'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
                        'AND "functionId"=(SELECT id FROM dms.app_function '
                        "WHERE code='groups.manage')"
                    )
            finally:
                blocker.rollback()
            response = pending.result(timeout=race_timeout(15))
    assert response.status_code == 403
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT name FROM dms.user_group WHERE id=:id"), {"id": identifier}
            )
            == "Target"
        )
        assert (
            connection.scalar(
                text('SELECT count(*) FROM dms.group_permission WHERE "groupId"=:id'),
                {"id": identifier},
            )
            == 1
        )
        assert (
            connection.scalar(
                text('SELECT count(*) FROM dms.audit_log WHERE "requestId"=:request'),
                {"request": response.headers["X-Request-Id"]},
            )
            == 0
        )
