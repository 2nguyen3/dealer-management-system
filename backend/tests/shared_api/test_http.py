from decimal import Decimal
from typing import Annotated
from unittest.mock import Mock

import pytest
from fastapi import APIRouter, Body, Header, HTTPException, Request, Response
from fastapi.testclient import TestClient
from pydantic import Field
from starlette.requests import Request as StarletteRequest

from app.common.preconditions import read_preconditions
from app.common.rate_limit import check_business_limit
from app.common.responses import field_pointer
from app.common.schemas import ApiModel, CatalogId, CatalogParameter, Money, NonEmptyText
from app.common.transport import BusinessRoute, matched_operation
from app.core.exceptions import ApiError, AuthError
from app.core.request_context import request_context
from app.main import create_app
from tests.support.contract import assert_schema


class Input(ApiModel):
    amount: Money
    password: NonEmptyText = Field(repr=False)


class Amount(ApiModel):
    amount: Money


@pytest.fixture
def client(settings):
    app = create_app(settings)
    router = APIRouter(route_class=BusinessRoute)

    @router.post("/probe", operation_id="probeBody")
    def body(value: Input):
        return {"amount": str(value.amount)}

    @router.post("/action", status_code=204, operation_id="probeAction")
    def action(request: Request, match: Annotated[str | None, Header(alias="If-Match")] = None):
        read_preconditions(request).compare('"current"')
        assert matched_operation(request) == "probeAction"
        return Response(status_code=204)

    @router.post("/raw", openapi_extra={"x-raw-body": True})
    async def raw(request: Request):
        return {"length": len(await request.body())}

    @router.get("/catalog/{identifier}")
    def catalog_parameter(identifier: CatalogParameter):
        return {"id": identifier}

    @router.post("/catalog-body")
    def catalog_body(identifier: Annotated[CatalogId, Body(embed=True)]):
        return {"id": identifier}

    @router.get("/decimal-response", response_model=Amount)
    def decimal_response():
        return {"amount": Decimal("1.00")}

    @router.get("/broken")
    def broken():
        raise RuntimeError("credential-sentinel")

    @router.get("/http-error")
    def http_error():
        raise HTTPException(400, detail="credential-sentinel")

    @router.get("/safe-error")
    def safe_error():
        raise ApiError(409, "RESOURCE_BUSY", "Resource is busy", details={"resourceId": "1"})

    @router.get("/auth-error")
    def auth_error():
        raise AuthError(401, "AUTH_REQUIRED", "Authentication required")

    @router.get("/limited", operation_id="probeLimited")
    def limited(request: Request):
        check_business_limit(request, 1)
        return {"ok": True}

    app.include_router(router, prefix="/api/v1")
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


@pytest.mark.parametrize(
    "content,headers,status",
    [
        ('{"amount":"1","password":"x"}', {}, 415),
        ("{credential-sentinel", {"Content-Type": "application/json"}, 400),
        (
            '{"amount":1,"password":"credential-sentinel"}',
            {"Content-Type": "application/json"},
            422,
        ),
        (
            '{"amount":"1","password":{},"credential-sentinel":true}',
            {"Content-Type": "application/json"},
            422,
        ),
        (b"\xff", {"Content-Type": "application/json"}, 400),
    ],
)
def test_business_errors_are_safe(client, content, headers, status):
    response = client.post("/api/v1/probe", content=content, headers=headers)
    assert response.status_code == status
    assert "credential-sentinel" not in response.text
    assert response.json()["requestId"] == response.headers["X-Request-Id"]
    assert_schema(response.json(), "Error")
    if status == 422:
        assert response.json()["fieldErrors"][0]["field"] in ("/amount", "/password")


def test_bodyless_raw_and_preconditions(client):
    assert client.post("/api/v1/probe", json={"amount": "1", "password": "x"}).json() == {
        "amount": "1"
    }
    assert client.post("/api/v1/action").status_code == 428
    stale = client.post("/api/v1/action", headers={"If-Match": '"old"'})
    assert stale.status_code == 412 and stale.headers["ETag"] == '"current"'
    success = client.post("/api/v1/action", headers={"If-Match": '"current"'})
    assert success.status_code == 204 and success.content == b""
    assert client.post("/api/v1/raw", content=b"signed bytes").json() == {"length": 12}
    repeated = client.post(
        "/api/v1/action", headers=[("If-Match", '"current"'), ("If-Match", '"old"')]
    )
    assert repeated.status_code == 422
    assert client.get("/api/v1/catalog/1").json() == {"id": 1}
    assert client.get("/api/v1/catalog/2147483648").status_code == 422
    assert client.post("/api/v1/catalog-body", json={"identifier": 1}).status_code == 200
    assert client.post("/api/v1/catalog-body", json={"identifier": "1"}).status_code == 422
    assert client.get("/api/v1/decimal-response").json() == {"amount": "1"}


def test_business_exception_and_browser_headers(client):
    for path, status in (
        ("broken", 500),
        ("http-error", 400),
        ("safe-error", 409),
        ("auth-error", 401),
    ):
        response = client.get("/api/v1/" + path)
        assert response.status_code == status and "credential-sentinel" not in response.text
        assert_schema(response.json(), "Error")
    preflight = client.options(
        "/api/v1/probe",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": (
                "authorization,if-match,if-none-match,idempotency-key"
            ),
        },
    )
    assert preflight.status_code == 200
    response = client.post(
        "/api/v1/action", headers={"Origin": "http://localhost:5173", "If-Match": '"old"'}
    )
    exposed = {
        item.strip() for item in response.headers["Access-Control-Expose-Headers"].split(",")
    }
    assert {"ETag", "Location", "Content-Disposition", "X-Request-Id", "Retry-After"} <= exposed
    assert "Access-Control-Allow-Credentials" not in response.headers
    assert field_pointer(("body", "a/b~", 0)) == "/a~1b~0/0"
    assert field_pointer(("query", "limit")) == "query.limit"


def test_business_limiter_and_operation_match(client):
    client.app.state.settings.api_rate_limit = 2
    for _ in range(2):
        assert client.get("/api/v1/limited").status_code == 200
    response = client.get("/api/v1/limited", headers={"X-Forwarded-For": "192.0.2.1"})
    assert response.status_code == 429 and int(response.headers["Retry-After"]) >= 1
    request = Mock()
    request.app.routes = []
    assert matched_operation(request) is None
    with pytest.raises(ValueError):
        check_business_limit(request, 1)


def test_raw_body_cannot_be_preparsed():
    router = APIRouter(route_class=BusinessRoute)
    with pytest.raises(ValueError, match="before parsing"):

        @router.post("/invalid-signed-body", openapi_extra={"x-raw-body": True})
        def invalid_signed_body(value: Input):
            return {}


@pytest.mark.anyio
async def test_middleware_owned_business_error():
    request = StarletteRequest(
        {
            "type": "http",
            "path": "/api/v1/probe",
            "headers": [],
            "query_string": b"",
        }
    )

    async def fail(request):
        raise ApiError(401, "AUTH_REQUIRED", "Authentication required")

    response = await request_context(request, fail)
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.headers["X-Request-Id"] == request.state.request_id


@pytest.fixture
def anyio_backend():
    return "asyncio"
