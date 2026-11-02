from unittest.mock import Mock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_session
from app.main import create_app
from app.modules.auth.dependencies import get_current_principal
from app.modules.auth.permissions import FUNCTION_CODES
from tests.support.contract import SOURCE, assert_schema

BODY_PATHS = [
    (method.upper(), path)
    for path, methods in SOURCE["paths"].items()
    if path.startswith("/auth/")
    for method in methods
    if method != "get"
]


def assert_source_schema(response, name):
    assert_schema(response.json(), name)


@pytest.fixture
def client(settings):
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: Mock()
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


@pytest.mark.parametrize("method,path", BODY_PATHS)
@pytest.mark.parametrize(
    "content,headers,status",
    [
        ("password=sentinel", {"Content-Type": "application/x-www-form-urlencoded"}, 415),
        ("{}", {}, 415),
        ("{secret-sentinel", {"Content-Type": "application/json"}, 400),
        ('{"extra":"secret-sentinel"}', {"Content-Type": "application/json; charset=utf-8"}, 422),
        ("null", {"Content-Type": "application/json"}, 422),
    ],
)
def test_all_body_routes_safe_errors(client, method, path, content, headers, status):
    client.app.dependency_overrides[get_current_principal] = lambda: Mock()
    response = client.request(method, "/api/v1" + path, content=content, headers=headers)
    assert response.status_code == status
    assert "sentinel" not in response.text
    assert response.json()["requestId"] == response.headers["X-Request-Id"]
    UUID(response.headers["X-Request-Id"])
    assert response.headers["Cache-Control"] == "no-store"
    assert_source_schema(response, "Error")


@pytest.mark.parametrize("header", [None, "Basic secret-sentinel", "Bearer", "Bearer not-a-jwt"])
def test_bearer_header_only(client, header):
    headers = {} if header is None else {"Authorization": header}
    response = client.get(
        "/api/v1/auth/me?accessToken=secret-sentinel",
        headers=headers,
        cookies={"accessToken": "secret-sentinel"},
    )
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert "sentinel" not in response.text
    assert_source_schema(response, "Error")


def test_runtime_operation_inventory_and_cors(client):
    runtime = client.get("/api/openapi.json").json()
    for path, methods in SOURCE["paths"].items():
        if not path.startswith("/auth/"):
            continue
        for method, expected in methods.items():
            actual = runtime["paths"]["/api/v1" + path][method]
            assert actual["operationId"] == expected["operationId"]
            assert set(actual["responses"]) == set(expected["responses"])
            if expected.get("security") == []:
                assert actual["security"] == []
            else:
                assert actual["security"] == [{"BearerAuth": []}]
    assert FUNCTION_CODES == set(SOURCE["components"]["schemas"]["FunctionCode"]["enum"])
    assert client.get("/api/docs").status_code == 200
    assert client.get("/api/v1/health").json() == {"status": "ok"}
    response = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,x-request-id",
        },
    )
    assert response.status_code == 200
    response = client.get("/api/v1/auth/me", headers={"Origin": "http://localhost:5173"})
    assert "Retry-After" in response.headers["Access-Control-Expose-Headers"]


def expand_schema(document, schema):
    if "$ref" in schema:
        target = document
        for segment in schema["$ref"][2:].split("/"):
            target = target[segment]
        return expand_schema(document, target)
    if "allOf" in schema:
        parts = [expand_schema(document, part) for part in schema["allOf"]]
        return {
            "type": "object",
            "required": sorted({name for part in parts for name in part.get("required", [])}),
            "properties": {
                name: definition
                for part in parts
                for name, definition in part.get("properties", {}).items()
            },
        }
    return schema


def assert_schema_constraints(source, actual, source_document, actual_document):
    source = expand_schema(source_document, source)
    actual = expand_schema(actual_document, actual)
    for key in (
        "type",
        "const",
        "minLength",
        "pattern",
        "format",
        "minimum",
        "maximum",
        "uniqueItems",
        "additionalProperties",
        "writeOnly",
        "readOnly",
    ):
        if key in source:
            assert actual.get(key) == source[key], (key, source, actual)
    for key in ("required", "enum"):
        if key in source:
            assert set(source[key]) == set(actual.get(key, []))
    for name, definition in source.get("properties", {}).items():
        assert name in actual["properties"]
        assert_schema_constraints(
            definition, actual["properties"][name], source_document, actual_document
        )
    if "items" in source:
        assert_schema_constraints(
            source["items"], actual["items"], source_document, actual_document
        )


def test_all_auth_reachable_schema_and_header_constraints(client):
    runtime = client.get("/api/openapi.json").json()
    for path, methods in SOURCE["paths"].items():
        if not path.startswith("/auth/"):
            continue
        for method, expected in methods.items():
            actual = runtime["paths"]["/api/v1" + path][method]
            if "requestBody" in expected:
                body = expand_schema(SOURCE, expected["requestBody"])
                assert_schema_constraints(
                    body["content"]["application/json"]["schema"],
                    actual["requestBody"]["content"]["application/json"]["schema"],
                    SOURCE,
                    runtime,
                )
            for status, response in expected["responses"].items():
                response = expand_schema(SOURCE, response)
                if "content" in response:
                    assert_schema_constraints(
                        response["content"]["application/json"]["schema"],
                        actual["responses"][status]["content"]["application/json"]["schema"],
                        SOURCE,
                        runtime,
                    )
                for header, definition in response.get("headers", {}).items():
                    definition = expand_schema(SOURCE, definition)
                    assert_schema_constraints(
                        definition["schema"],
                        actual["responses"][status]["headers"][header]["schema"],
                        SOURCE,
                        runtime,
                    )


@pytest.mark.parametrize(
    "method,path",
    [
        (method.upper(), path)
        for path, methods in SOURCE["paths"].items()
        if path.startswith("/auth/")
        for method in methods
    ],
)
def test_all_operations_throttled(settings, method, path):
    settings.auth_rate_limit = 1
    app = create_app(settings)
    app.dependency_overrides[get_session] = lambda: Mock()
    with TestClient(app) as client:
        client.get("/api/v1/auth/me")
        response = client.request(method, "/api/v1" + path, json={})
    assert response.status_code == 429 and int(response.headers["Retry-After"]) >= 1
    assert_source_schema(response, "Error")


def test_database_and_unexpected_failure_are_safe(client):
    response = client.post(
        "/api/v1/auth/login", json={"email": "employee@example.com", "password": "secret-sentinel"}
    )
    assert response.status_code == 500
    assert "sentinel" not in response.text
    assert_source_schema(response, "Error")


def test_invalid_utf8_safe_http_error_and_public_404(client):
    response = client.post(
        "/api/v1/auth/login",
        content=b"\xffsecret-sentinel",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 400 and "sentinel" not in response.text
    assert_source_schema(response, "Error")
    assert client.get("/missing").json() == {"detail": "Not Found"}
