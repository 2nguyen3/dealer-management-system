from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.modules.auth.service import AuthService
from tests.auth.test_http import assert_schema_constraints
from tests.integration.catalogues.conftest import CASES
from tests.support.contract import SOURCE, assert_schema, resolve

pytestmark = pytest.mark.integration


def test_five_operations_exact_contract_and_mutations(client, resource, engine):
    schema, body = CASES[resource][1:]
    collection = "/api/v1/" + resource
    created = client.post(collection, json=body)
    assert created.status_code == 201, created.text
    assert_schema(created.json(), schema)
    path = created.headers["Location"]
    detail = client.get(path)
    assert detail.status_code == 200 and detail.headers["ETag"] == created.headers["ETag"]
    change = {"fullName": "Changed"} if resource == "users" else {"name": "Changed"}
    assert client.patch(path, json=change).status_code == 428
    updated = client.patch(path, json=change, headers={"If-Match": detail.headers["ETag"]})
    assert updated.status_code == 200, updated.text
    assert_schema(updated.json(), schema)
    assert updated.headers["ETag"] != detail.headers["ETag"]
    stale = client.patch(path, json=change, headers={"If-Match": detail.headers["ETag"]})
    assert stale.status_code == 412 and stale.headers["ETag"] == updated.headers["ETag"]
    listed = client.get(collection, params={"q": "Changed", "limit": 1})
    assert listed.status_code == 200 and listed.json()["items"][0] == updated.json()
    assert_schema(listed.json(), schema + "ListResponse")
    if resource == "units":
        assert (
            client.get(collection, params={"allowsFraction": "false", "code": "NEW"}).json()[
                "items"
            ][0]["id"]
            == created.json()["id"]
        )
        assert (
            client.get(collection, params={"allowsFraction": "true", "code": "NEW"}).json()["items"]
            == []
        )
    if resource == "users":
        assert client.post(path + "/password-reset", json={"newPassword": "x"}).status_code == 428
        assert (
            client.post(
                path + "/password-reset",
                json={"newPassword": "x"},
                headers={"If-Match": created.headers["ETag"]},
            ).status_code
            == 412
        )
        removed = client.post(
            path + "/password-reset",
            json={"newPassword": " "},
            headers={"If-Match": updated.headers["ETag"]},
        )
        assert client.delete(path).status_code == 405
    else:
        removed = client.delete(path, headers={"If-Match": updated.headers["ETag"]})
        assert client.get(path).status_code == 404
        assert client.delete(path, headers={"If-Match": updated.headers["ETag"]}).status_code == 404
    assert removed.status_code == 204 and removed.content == b""
    with engine.connect() as connection:
        audit = connection.execute(
            text('SELECT "functionCode","newData" FROM dms.audit_log WHERE "requestId"=:id'),
            {"id": created.headers["X-Request-Id"]},
        ).one()
        assert audit[0] == CASES[resource][0].permission
        assert "passwordHash" not in audit[1] and "password" not in audit[1]


def test_runtime_matches_every_source_schema_parameter_response_header(client, resource):
    runtime = client.get("/api/openapi.json").json()
    paths = [
        path
        for path in SOURCE["paths"]
        if path == "/" + resource or path.startswith("/" + resource + "/{")
    ]
    assert sum(len(SOURCE["paths"][p]) - ("parameters" in SOURCE["paths"][p]) for p in paths) == 5
    for path in paths:
        for method, expected in SOURCE["paths"][path].items():
            if method == "parameters":
                continue
            actual = runtime["paths"]["/api/v1" + path][method]
            assert actual["operationId"] == expected["operationId"]
            assert set(actual["responses"]) == set(expected["responses"])
            assert actual["security"] == [{"BearerAuth": []}]
            assert actual["x-permissions"] == expected["x-permissions"]
            parameters = {item["name"]: item for item in actual.get("parameters", [])}
            for item in SOURCE["paths"][path].get("parameters", []) + expected.get(
                "parameters", []
            ):
                definition = resolve(item)
                parameter = parameters[definition["name"]]
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
                assert_schema_constraints(
                    resolve(expected["requestBody"])["content"]["application/json"]["schema"],
                    actual["requestBody"]["content"]["application/json"]["schema"],
                    SOURCE,
                    runtime,
                )


def test_safe_transport_missing_ids_preconditions(client, resource):
    path = "/api/v1/" + resource
    for content, headers, status in (
        ("{credential-sentinel", {"Content-Type": "application/json"}, 400),
        ("{}", {}, 415),
        ('{"credential-sentinel":true}', {"Content-Type": "application/json"}, 422),
    ):
        response = client.post(path, content=content, headers=headers)
        assert response.status_code == status and "credential-sentinel" not in response.text
        assert_schema(response.json(), "Error")
    for identifier in (
        "0",
        "-1",
        "01",
        "9223372036854775808" if resource == "users" else "2147483648",
    ):
        assert client.get(path + "/" + identifier).status_code == 422
    assert client.get(path + "/999999").status_code == 404
    change = {"fullName": "Next"} if resource == "users" else {"name": "Next"}
    assert (
        client.patch(path + "/999999", json=change, headers={"If-Match": '"x"'}).status_code == 404
    )
    created = client.post(path, json=CASES[resource][2])
    detail = created.headers["Location"]
    for headers in (
        {"If-Match": "bad"},
        [("If-Match", created.headers["ETag"]), ("If-Match", '"x"')],
    ):
        assert client.patch(detail, json=change, headers=headers).status_code == 422
    assert client.get(path, params={"sort": "bad"}).status_code == 422
    assert client.get(path, params={"cursor": "bad"}).status_code == 400


def test_current_permission_admission_recheck_and_each_read_alternative(client, resource, engine):
    path = "/api/v1/" + resource
    operations = SOURCE["paths"]["/" + resource]
    policy = operations["get"]["x-permissions"]
    for code in policy.get("anyOf", policy.get("allOf", [])):
        with engine.begin() as connection:
            connection.execute(
                text(
                    'UPDATE dms.group_permission SET "isAllowed"=("functionId"='
                    '(SELECT id FROM dms.app_function WHERE code=:code)) WHERE "groupId"=1'
                ),
                {"code": code},
            )
        assert client.get(path).status_code == 200
        response = client.post(path, json=CASES[resource][2])
        assert response.status_code == (201 if code == CASES[resource][0].permission else 403)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1'
        )
    assert client.get(path).status_code == 403
    assert client.post(path, json=CASES[resource][2]).status_code == 403
    with engine.begin() as connection:
        connection.exec_driver_sql(
            'UPDATE dms.group_permission SET "isAllowed"=true WHERE "groupId"=1'
        )
    original = AuthService.get_current_user
    calls = 0

    def changed(self, principal):
        nonlocal calls
        calls += 1
        item = original(self, principal)
        return item if calls == 1 else item.model_copy(update={"allowedFunctions": []})

    with patch.object(AuthService, "get_current_user", changed):
        assert client.post(path, json=CASES[resource][2]).status_code == 403
    assert calls == 2
    client.headers.clear()
    assert client.get(path).status_code == 401
