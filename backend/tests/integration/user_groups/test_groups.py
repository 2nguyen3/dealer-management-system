from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.common.preconditions import parse_preconditions
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.modules.auth.service import AuthService
from app.modules.user_groups.schemas import GroupCreate, GroupUpdate
from app.modules.user_groups.service import group_etag
from tests.auth.test_http import assert_schema_constraints
from tests.support.contract import SOURCE, assert_schema, resolve

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("operation", ["create", "update", "delete"])
def test_repository_mutations_remain_in_caller_transaction(service, engine, operation):
    group = service.create(GroupCreate(code="CALLER", name="Caller"))
    with engine.begin() as connection:
        connection.execute(
            text('INSERT INTO dms.group_permission ("groupId","functionId") VALUES (:id,1)'),
            {"id": group.id},
        )
    set_audit_context(
        service.session, service.actor_id, "repository-rollback", function_code="groups.manage"
    )
    if operation == "create":
        service.repo.create(code="UNCOMMITTED", name="Uncommitted")
    elif operation == "update":
        service.repo.update(group.id, {"name": "Uncommitted"})
    else:
        service.repo.delete(group.id)

    # An independent connection must still see only the committed state.
    with engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT name FROM dms.user_group WHERE code='CALLER'"))
            == "Caller"
        )
        assert (
            connection.scalar(text("SELECT count(*) FROM dms.user_group WHERE code='UNCOMMITTED'"))
            == 0
        )
        assert (
            connection.scalar(
                text('SELECT count(*) FROM dms.group_permission WHERE "groupId"=:id'),
                {"id": group.id},
            )
            == 1
        )
    service.session.rollback()
    assert service.get(group.id).name == "Caller"
    with engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT count(*) FROM dms.user_group WHERE code='UNCOMMITTED'"))
            == 0
        )
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.audit_log WHERE \"requestId\"='repository-rollback'")
            )
            == 0
        )


def test_create_update_delete_audit_and_safe_contract(client, engine):
    created = client.post("/api/v1/user-groups", json={"code": "SUPPORT", "name": "Support"})
    assert created.status_code == 201
    assert_schema(created.json(), "Group")
    path = created.headers["Location"]
    assert created.json()["userCount"] == 0
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text('SELECT count(*) FROM dms.group_permission WHERE "groupId"=:id'),
                {"id": created.json()["id"]},
            )
            == 0
        )
        assert (
            connection.scalar(
                text('SELECT "functionCode" FROM dms.audit_log WHERE "requestId"=:id'),
                {"id": created.headers["X-Request-Id"]},
            )
            == "groups.manage"
        )
    assert client.patch(path, json={"name": "Next"}).status_code == 428
    updated = client.patch(
        path, json={"name": "Next"}, headers={"If-Match": created.headers["ETag"]}
    )
    assert updated.status_code == 200 and updated.json()["code"] == "SUPPORT"
    assert updated.headers["ETag"] != created.headers["ETag"]
    stale = client.delete(path, headers={"If-Match": created.headers["ETag"]})
    assert stale.status_code == 412 and stale.headers["ETag"] == updated.headers["ETag"]
    deleted = client.delete(path, headers={"If-Match": updated.headers["ETag"]})
    assert deleted.status_code == 204 and deleted.content == b""
    assert client.get(path).status_code == 404
    assert client.delete(path, headers={"If-Match": updated.headers["ETag"]}).status_code == 404
    assert client.get("/api/v1/user-groups/2147483648").status_code == 422


@pytest.mark.parametrize("status", ["ACTIVE", "LOCKED"])
def test_references_count_and_block_delete(client, engine, status):
    created = client.post("/api/v1/user-groups", json={"code": "TEAM", "name": "Team"})
    path, identifier = created.headers["Location"], created.json()["id"]
    with engine.begin() as connection:
        connection.execute(
            text('INSERT INTO dms.group_permission ("groupId","functionId") VALUES (:id,1)'),
            {"id": identifier},
        )
        connection.execute(
            text(
                'INSERT INTO dms.app_user ("fullName",email,"passwordHash","groupId",status) '
                "VALUES ('Member','member@example.com','hash',:id,:status)"
            ),
            {"id": identifier, "status": status},
        )
    detail = client.get(path)
    assert detail.json()["userCount"] == 1 and detail.headers["ETag"] != created.headers["ETag"]
    response = client.delete(path, headers={"If-Match": detail.headers["ETag"]})
    assert response.status_code == 409 and response.json()["code"] == "RESOURCE_IN_USE"
    assert_schema(response.json(), "Error")
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text('SELECT count(*) FROM dms.group_permission WHERE "groupId"=:id'),
                {"id": identifier},
            )
            == 1
        )


def test_grant_cleanup_and_rollback(service, engine):
    group = service.create(GroupCreate(code="TEAM", name="Team"))
    with engine.begin() as connection:
        connection.execute(
            text(
                'INSERT INTO dms.group_permission ("groupId","functionId","isAllowed") '
                "VALUES (:id,1,true)"
            ),
            {"id": group.id},
        )
    before = service.get(group.id)
    original = service.session.execute

    def fail(sql, *args, **kwargs):
        if str(sql) == "SET CONSTRAINTS ALL IMMEDIATE":
            raise RuntimeError("injected after cleanup")
        return original(sql, *args, **kwargs)

    with patch.object(service.session, "execute", side_effect=fail), pytest.raises(RuntimeError):
        service.delete(group.id, parse_preconditions(group_etag(before)))
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text('SELECT count(*) FROM dms.group_permission WHERE "groupId"=:id'),
                {"id": group.id},
            )
            == 1
        )
    before_audit = service.session.scalar(text("SELECT count(*) FROM dms.audit_log"))
    with patch.object(service.session, "commit", side_effect=RuntimeError("commit failure")):
        with pytest.raises(RuntimeError):
            service.delete(group.id, parse_preconditions(group_etag(service.get(group.id))))
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM dms.audit_log")) == before_audit
        assert (
            connection.scalar(
                text('SELECT count(*) FROM dms.group_permission WHERE "groupId"=:id'),
                {"id": group.id},
            )
            == 1
        )
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.user_group WHERE id=:id"), {"id": group.id}
            )
            == 1
        )
    service.delete(group.id, parse_preconditions(group_etag(service.get(group.id))))
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text('SELECT count(*) FROM dms.group_permission WHERE "groupId"=:id'),
                {"id": group.id},
            )
            == 0
        )
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM dms.audit_log WHERE action='DELETE' "
                    "AND \"requestId\"='group-request'"
                )
            )
            == 2
        )


def test_duplicates_case_sensitive_commit_failure_and_missing(service, engine):
    first = service.create(GroupCreate(code="CASE", name="Case"))
    for body in (GroupCreate(code="CASE", name="Other"), GroupCreate(code="OTHER", name="Case")):
        with pytest.raises(ApiError, match="DUPLICATE"):
            service.create(body)
    assert service.create(GroupCreate(code="case", name="case")).id != first.id
    with (
        patch.object(service.session, "commit", side_effect=RuntimeError("injected")),
        pytest.raises(RuntimeError),
    ):
        service.create(GroupCreate(code="ROLLBACK", name="Rollback"))
    with engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT count(*) FROM dms.user_group WHERE code='ROLLBACK'"))
            == 0
        )
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.audit_log WHERE \"newData\"->>'code'='ROLLBACK'")
            )
            == 0
        )
    with pytest.raises(ApiError, match="NOT_FOUND"):
        service.update(99999, GroupUpdate(name="x"), parse_preconditions('"x"'))


@pytest.mark.parametrize("sort", ["id", "-id", "code", "-code", "name", "-name"])
def test_pagination_search_and_cursor_scope(service, sort):
    for code, name in (("TEST_2", "Zebra"), ("TEST_0", "Beta"), ("TEST_1", "Alpha")):
        service.create(GroupCreate(code=code, name=name))
    expected = {
        "id": ["TEST_2", "TEST_0", "TEST_1"],
        "-id": ["TEST_1", "TEST_0", "TEST_2"],
        "code": ["TEST_0", "TEST_1", "TEST_2"],
        "-code": ["TEST_2", "TEST_1", "TEST_0"],
        "name": ["TEST_1", "TEST_0", "TEST_2"],
        "-name": ["TEST_2", "TEST_0", "TEST_1"],
    }[sort]
    first = service.list(q=" TEST_ ", sort=sort, limit=1)
    actual = list(first.items)
    cursor = first.pagination.nextCursor
    while cursor:
        page = service.list(q="TEST_", sort=sort, limit=1, cursor=cursor)
        actual.extend(page.items)
        cursor = page.pagination.nextCursor
    assert [item.code for item in actual] == expected
    assert service.list(code="TEST_1").items[0].code == "TEST_1"
    assert service.list(q="%").items == []
    assert service.list(code="missing").items == []
    with pytest.raises(ApiError, match="INVALID_CURSOR"):
        service.list(q="changed", sort=sort, cursor=first.pagination.nextCursor)


@pytest.mark.parametrize("sort", ["code", "name"])
def test_long_text_pagination_and_deleted_anchor(service, sort):
    groups = [
        service.create(
            GroupCreate(code="LONG_" + "x" * 7000 + suffix, name="LONG_" + "n" * 7000 + suffix)
        )
        for suffix in ("A", "B")
    ]
    first = service.list(q="LONG_", sort=sort, limit=1)
    assert len(first.pagination.nextCursor) < 256
    second = service.list(q="LONG_", sort=sort, limit=1, cursor=first.pagination.nextCursor)
    assert second.items[0].id == groups[1].id and not second.pagination.hasMore
    service.delete(groups[0].id, parse_preconditions(group_etag(service.get(groups[0].id))))
    with pytest.raises(ApiError, match="INVALID_CURSOR"):
        service.list(q="LONG_", sort=sort, limit=1, cursor=first.pagination.nextCursor)


def test_permissions_and_current_recheck(client, engine):
    with engine.begin() as connection:
        connection.exec_driver_sql(
            'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1'
        )
    assert client.get("/api/v1/user-groups").status_code == 403
    assert client.post("/api/v1/user-groups", json={"code": "x", "name": "x"}).status_code == 403
    for code in ("groups.manage", "users.manage", "permissions.manage"):
        with engine.begin() as connection:
            connection.execute(
                text(
                    'UPDATE dms.group_permission SET "isAllowed"=("functionId"='
                    '(SELECT id FROM dms.app_function WHERE code=:code)) WHERE "groupId"=1'
                ),
                {"code": code},
            )
        assert client.get("/api/v1/user-groups").status_code == 200
        assert (
            client.delete("/api/v1/user-groups/2", headers={"If-Match": '"x"'}).status_code == 403
        )
    without = dict(client.headers)
    del without["authorization"]
    client.headers.clear()
    assert client.get("/api/v1/user-groups").status_code == 401


def test_grants_rechecked_after_route_admission(client, engine):
    original = AuthService.get_current_user
    calls = 0

    def changed(self, principal):
        nonlocal calls
        calls += 1
        result = original(self, principal)
        return result if calls == 1 else result.model_copy(update={"allowedFunctions": []})

    with patch.object(AuthService, "get_current_user", changed):
        response = client.post("/api/v1/user-groups", json={"code": "DENIED", "name": "Denied"})
    assert response.status_code == 403 and calls == 2
    with engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT count(*) FROM dms.user_group WHERE code='DENIED'")) == 0
        )


def test_runtime_source_inventory_schemas_headers_and_safe_validation(client):
    runtime = client.get("/api/openapi.json").json()
    for path in ("/user-groups", "/user-groups/{groupId}"):
        for method, expected in SOURCE["paths"][path].items():
            if method == "parameters":
                continue
            actual = runtime["paths"]["/api/v1" + path][method]
            assert actual["operationId"] == expected["operationId"]
            assert set(actual["responses"]) == set(expected["responses"])
            assert actual["security"] == [{"BearerAuth": []}]
            assert actual["x-permissions"] == expected["x-permissions"]
            actual_parameters = {item["name"]: item for item in actual.get("parameters", [])}
            for item in SOURCE["paths"][path].get("parameters", []) + expected.get(
                "parameters", []
            ):
                definition = resolve(item)
                parameter = actual_parameters[definition["name"]]
                assert parameter["required"] == definition.get("required", False)
                schema = parameter["schema"]
                if "anyOf" in schema:
                    schema = next(part for part in schema["anyOf"] if part.get("type") != "null")
                assert_schema_constraints(definition["schema"], schema, SOURCE, runtime)
            for status, expected_response in expected["responses"].items():
                source = resolve(expected_response)
                for header, definition in source.get("headers", {}).items():
                    assert_schema_constraints(
                        resolve(definition)["schema"],
                        actual["responses"][status]["headers"][header]["schema"],
                        SOURCE,
                        runtime,
                    )
                if "content" in source:
                    assert_schema_constraints(
                        source["content"]["application/json"]["schema"],
                        actual["responses"][status]["content"]["application/json"]["schema"],
                        SOURCE,
                        runtime,
                    )
            if "requestBody" in expected:
                schema = resolve(expected["requestBody"])["content"]["application/json"]["schema"]
                assert_schema_constraints(
                    schema,
                    actual["requestBody"]["content"]["application/json"]["schema"],
                    SOURCE,
                    runtime,
                )
    for content, headers, status in (
        ("{credential-sentinel", {"Content-Type": "application/json"}, 400),
        ("{}", {}, 415),
        (
            '{"code":"x","name":"x","credential-sentinel":true}',
            {"Content-Type": "application/json"},
            422,
        ),
    ):
        response = client.post("/api/v1/user-groups", content=content, headers=headers)
        assert response.status_code == status and "credential-sentinel" not in response.text
        assert_schema(response.json(), "Error")
    group = client.get("/api/v1/user-groups/1")
    duplicate = client.patch(
        "/api/v1/user-groups/1",
        json={"name": "x"},
        headers=[("If-Match", group.headers["ETag"]), ("If-Match", '"x"')],
    )
    assert duplicate.status_code == 422
