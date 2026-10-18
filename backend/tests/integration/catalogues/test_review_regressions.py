import time
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import parse_preconditions
from app.core.exceptions import ApiError
from app.modules.user_groups.schemas import GroupUpdate
from app.modules.user_groups.service import GroupService, group_etag
from app.modules.users.schemas import AdminPasswordReset, UserCreate, UserUpdate
from tests.integration.catalogues.conftest import CASES
from tests.integration.catalogues.helpers import agency, service_for
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.catalogues.test_state import create_body, precondition, update_body
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def test_mutated_anchor_sort_or_filter_is_rejected(use_case, resource):
    for index in range(3):
        body = dict(CASES[resource][2])
        body.update(
            {"fullName": "PAGE_" + str(index), "email": f"page{index}@example.com"}
            if resource == "users"
            else {"code": "PAGE_" + str(index), "name": "PAGE_" + str(index)}
        )
        use_case.create(create_body(use_case, body))
    sort = "fullName" if resource == "users" else "name"
    page = use_case.list(q="PAGE_", sort=sort, limit=1)
    anchor = page.items[0]
    use_case.update(
        int(anchor.id),
        update_body(resource, {sort: "PAGE_Z"}),
        precondition(use_case, int(anchor.id)),
    )
    with pytest.raises(ApiError, match="INVALID_CURSOR"):
        use_case.list(q="PAGE_", sort=sort, limit=1, cursor=page.pagination.nextCursor)
    page = use_case.list(q="PAGE_", status="ACTIVE", limit=1)
    anchor = page.items[0]
    use_case.update(
        int(anchor.id),
        update_body(resource, {"status": "LOCKED" if resource == "users" else "INACTIVE"}),
        precondition(use_case, int(anchor.id)),
    )
    with pytest.raises(ApiError, match="INVALID_CURSOR"):
        use_case.list(q="PAGE_", status="ACTIVE", limit=1, cursor=page.pagination.nextCursor)


@pytest.mark.parametrize("first", ["user", "group"])
@pytest.mark.parametrize("action", ["profile", "reset"])
def test_joined_group_labels_serialize_user_etags(engine, actor, first, action):
    with Session(engine) as session:
        users = service_for("users", session, actor)
        user = users.create(
            UserCreate(fullName="Member", email="member@example.com", password="x", groupId=2)
        )
        match = users.etag(user)
        groups = GroupService(session, CursorCodec(b"x" * 32), actor, "fixture", lambda _: None)
        group_match = group_etag(groups.get(2))

    def user_write(session):
        users = service_for("users", session, actor)
        if action == "profile":
            users.update(int(user.id), UserUpdate(fullName="Updated"), parse_preconditions(match))
        else:
            users.reset_password(
                int(user.id), AdminPasswordReset(newPassword="new"), parse_preconditions(match)
            )
        return "user"

    def group_write(session):
        groups = GroupService(
            session, CursorCodec(b"x" * 32), actor, "race-request", lambda _: None
        )
        groups.update(2, GroupUpdate(name="Renamed"), parse_preconditions(group_match))
        return "group"

    results = ordered_race(
        engine,
        user_write if first == "user" else group_write,
        group_write if first == "user" else user_write,
    )
    assert results == (("user", "group") if first == "user" else ("group", "PRECONDITION_FAILED"))
    with Session(engine) as session:
        current = service_for("users", session, actor).get(int(user.id))
        assert current.groupName == "Renamed"
        assert current.fullName == (
            "Updated" if first == "user" and action == "profile" else "Member"
        )


def test_grant_revoked_while_type_waits_for_balance(client, engine):
    created = client.post(
        "/api/v1/agency-types", json={"code": "TARGET", "name": "Target", "maxDebt": "10"}
    )
    identifier = created.json()["id"]
    with Session(engine) as session:
        agency_id = agency(session, type_id=identifier)
        session.commit()
    detail = client.get(created.headers["Location"])
    with Session(engine) as blocker:
        blocker.execute(
            text('SELECT "agencyId" FROM dms.agency_balance WHERE "agencyId"=:id FOR UPDATE'),
            {"id": agency_id},
        )
        with ThreadPoolExecutor(1) as pool:
            pending = pool.submit(
                client.patch,
                created.headers["Location"],
                json={"maxDebt": "0"},
                headers={"If-Match": detail.headers["ETag"]},
            )
            try:
                deadline = time.monotonic() + race_timeout(5)
                with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as observer:
                    while time.monotonic() < deadline:
                        if observer.scalar(
                            text(
                                "SELECT pid FROM pg_stat_activity WHERE datname=:db "
                                "AND wait_event_type='Lock' AND query LIKE '%agency_balance%'"
                            ),
                            {"db": engine.url.database},
                        ):
                            break
                        Event().wait(0.01)
                    else:
                        pytest.fail("Expected real balance lock wait")
                with engine.begin() as connection:
                    connection.exec_driver_sql(
                        'UPDATE dms.group_permission SET "isAllowed"=false '
                        'WHERE "groupId"=1 AND "functionId"=(SELECT id FROM dms.app_function '
                        "WHERE code='agency_type.manage')"
                    )
            finally:
                blocker.rollback()
            response = pending.result(timeout=race_timeout(15))
    assert response.status_code == 403
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text('SELECT "maxDebt" FROM dms.agency_type WHERE id=:id'), {"id": identifier}
            )
            == 10
        )
        assert (
            connection.scalar(
                text('SELECT count(*) FROM dms.audit_log WHERE "requestId"=:id'),
                {"id": response.headers["X-Request-Id"]},
            )
            == 0
        )
