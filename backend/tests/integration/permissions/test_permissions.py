from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.permissions.schemas import PermissionSet
from app.modules.permissions.service import PermissionService
from app.modules.user_groups.schemas import GroupCreate
from app.modules.user_groups.service import GroupService, group_etag
from tests.integration.catalogues.test_races import ordered_race
from tests.support.contract import assert_schema
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("leading", ["grant", "delete"])
def test_owning_group_deletion_and_grant_write_both_orders(engine, actor, leading):
    with Session(engine) as session:
        groups = GroupService(session, CursorCodec(b"x" * 32), actor, "new-group", lambda _: None)
        group = groups.create(GroupCreate(code="PAIR", name="Pair"))

    def grant(session):
        svc = PermissionService(
            session, CursorCodec(b"x" * 32), actor, "group-grant-race", lambda _: None
        )
        item, created = svc.set(
            group.id, 1, PermissionSet(isAllowed=True), Preconditions(None, True)
        )
        return "created" if created else item

    def delete(session):
        svc = GroupService(
            session, CursorCodec(b"x" * 32), actor, "group-delete-race", lambda _: None
        )
        svc.delete(group.id, Preconditions(group_etag(group)))
        return "deleted"

    first, second = ordered_race(
        engine, grant if leading == "grant" else delete, delete if leading == "grant" else grant
    )
    assert (first, second) == (
        ("created", "deleted") if leading == "grant" else ("deleted", "NOT_FOUND")
    )
    with engine.connect() as c:
        assert (
            c.execute(
                text('SELECT count(*) FROM dms.group_permission WHERE "groupId"=:id'),
                {"id": group.id},
            ).scalar()
            == 0
        )


def test_registry_and_grants_contract(client, engine):
    page = client.get("/api/v1/functions", params={"limit": 100})
    assert page.status_code == 200 and len(page.json()["items"]) == 33
    assert_schema(page.json(), "FunctionListResponse")
    function = page.json()["items"][0]
    assert client.get(f"/api/v1/functions/{function['id']}").json() == function
    assert client.get("/api/v1/functions/9999").status_code == 404
    assert client.post("/api/v1/functions", json={}).status_code == 405
    assert client.get("/api/v1/functions", params={"q": "users", "code": "users.manage"}).json()[
        "items"
    ] == [function]
    for sort in ("id", "-id", "code", "-code", "name", "-name"):
        first = client.get("/api/v1/functions", params={"sort": sort, "limit": 1}).json()
        second = client.get(
            "/api/v1/functions",
            params={"sort": sort, "limit": 1, "cursor": first["pagination"]["nextCursor"]},
        )
        assert second.status_code == 200 and second.json()["items"][0] != first["items"][0]
    path = "/api/v1/user-groups/2/permissions/1"
    with engine.begin() as c:
        c.exec_driver_sql('DELETE FROM dms.group_permission WHERE "groupId"=2 AND "functionId"=1')
    assert client.get(path).status_code == 404
    assert client.put(path, json={"isAllowed": True}).status_code == 428
    created = client.put(path, json={"isAllowed": True}, headers={"If-None-Match": "*"})
    assert created.status_code == 201, created.text
    assert created.headers["Location"] == path
    assert_schema(created.json(), "Permission")
    assert client.get(path).headers["ETag"] == created.headers["ETag"]
    assert (
        client.put(path, json={"isAllowed": True}, headers={"If-None-Match": "*"}).status_code
        == 412
    )
    revoked = client.put(
        path, json={"isAllowed": False}, headers={"If-Match": created.headers["ETag"]}
    )
    assert revoked.status_code == 200 and not revoked.json()["isAllowed"]
    assert (
        client.put(
            path, json={"isAllowed": True}, headers={"If-Match": created.headers["ETag"]}
        ).status_code
        == 412
    )
    assert (
        client.put(
            path,
            json={"isAllowed": True},
            headers={"If-Match": revoked.headers["ETag"], "If-None-Match": "*"},
        ).status_code
        == 422
    )
    for sort in ("functionId", "-functionId", "id", "-id"):
        first = client.get(
            "/api/v1/user-groups/1/permissions", params={"limit": 1, "sort": sort}
        ).json()
        next_page = client.get(
            "/api/v1/user-groups/1/permissions",
            params={"limit": 1, "sort": sort, "cursor": first["pagination"]["nextCursor"]},
        )
        assert next_page.status_code == 200
    filtered = client.get(
        "/api/v1/user-groups/2/permissions",
        params={"isAllowed": False, "functionCode": "users.manage"},
    )
    assert filtered.json()["items"] == [revoked.json()]
    assert_schema(filtered.json(), "PermissionListResponse")
    assert client.get("/api/v1/user-groups/9999/permissions").status_code == 404
    assert (
        client.put(
            "/api/v1/user-groups/9999/permissions/1",
            json={"isAllowed": True},
            headers={"If-None-Match": "*"},
        ).status_code
        == 404
    )
    assert (
        client.put(
            "/api/v1/user-groups/2/permissions/9999",
            json={"isAllowed": True},
            headers={"If-None-Match": "*"},
        ).status_code
        == 404
    )
    with engine.connect() as c:
        audit = c.execute(
            text(
                'SELECT "actorId","functionCode","newData" FROM dms.audit_log '
                'WHERE "requestId"=:request'
            ),
            {"request": revoked.headers["X-Request-Id"]},
        ).one()
        assert (
            audit[0] is not None and audit[1] == "permissions.manage" and not audit[2]["isAllowed"]
        )


def test_next_request_no_management_bypass(client):
    path = "/api/v1/user-groups/1/permissions/3"
    grant = client.get(path)
    revoked = client.put(
        path, json={"isAllowed": False}, headers={"If-Match": grant.headers["ETag"]}
    )
    assert revoked.status_code == 200
    assert client.get("/api/v1/functions").status_code == 403
    client.headers.pop("Authorization")
    assert client.get("/api/v1/functions").status_code == 401


def test_rollback_and_pair_races(engine, actor):
    with engine.begin() as c:
        c.exec_driver_sql('DELETE FROM dms.group_permission WHERE "groupId"=2 AND "functionId"=1')
    with Session(engine) as session:
        svc = PermissionService(
            session, CursorCodec(b"x" * 32), actor, "rollback-permission", lambda _: None
        )
        with patch.object(svc, "get_pair", side_effect=RuntimeError("forced")):
            with pytest.raises(RuntimeError):
                svc.set(2, 1, PermissionSet(isAllowed=True), Preconditions(None, True))
    with engine.connect() as c:
        assert (
            c.exec_driver_sql(
                'SELECT count(*) FROM dms.group_permission WHERE "groupId"=2 AND "functionId"=1'
            ).scalar()
            == 0
        )
        assert (
            c.exec_driver_sql(
                "SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='rollback-permission'"
            ).scalar()
            == 0
        )
    barrier = Barrier(2)

    def writer(condition):
        with Session(engine) as session:
            svc = PermissionService(
                session, CursorCodec(b"x" * 32), actor, "race-permission", lambda _: None
            )
            barrier.wait()
            try:
                item, created = svc.set(
                    2, 1, PermissionSet(isAllowed=condition.create_only), condition
                )
                return 201 if created else 200, svc.etag(item)
            except ApiError as error:
                return error.status, None

    with ThreadPoolExecutor(2) as pool:
        outcomes = list(pool.map(writer, [Preconditions(None, True)] * 2))
    assert sorted(status for status, _ in outcomes) == [201, 412]
    tag = next(tag for status, tag in outcomes if status == 201)
    with ThreadPoolExecutor(2) as pool:
        outcomes = list(pool.map(writer, [Preconditions(tag)] * 2))
    assert sorted(status for status, _ in outcomes) == [200, 412]


def test_set_waits_for_deleted_owner(engine, actor):
    with engine.begin() as connection:
        group = connection.exec_driver_sql(
            "INSERT INTO dms.user_group(code,name) VALUES ('RACE','Race') RETURNING id"
        ).scalar_one()
    with Session(engine) as deleting, ThreadPoolExecutor(1) as pool:
        deleting.execute(
            text("SELECT id FROM dms.user_group WHERE id=:id FOR UPDATE"), {"id": group}
        )

        def set_grant():
            with Session(engine) as session:
                svc = PermissionService(
                    session, CursorCodec(b"x" * 32), actor, "deleted-owner", lambda _: None
                )
                try:
                    svc.set(group, 1, PermissionSet(isAllowed=True), Preconditions(None, True))
                except ApiError as error:
                    return error.status

        future = pool.submit(set_grant)
        # Deletion and grant creation share the parent lock, including absent pairs.
        deleting.execute(text("DELETE FROM dms.user_group WHERE id=:id"), {"id": group})
        deleting.commit()
        assert future.result(timeout=race_timeout(10)) == 404
