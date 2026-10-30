from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.parse import urlsplit

import anyio
import pytest
from fastapi.testclient import TestClient

from app.common.pagination import CursorCodec
from app.core.exceptions import ApiError, AuthError
from app.main import create_app
from app.modules.auth.dependencies import get_auth_service, get_current_principal
from app.modules.reports.dependencies import get_report_service
from tests.online_payments.test_vnpay import config
from tests.reports.test_exports import dataset


@pytest.fixture
def runtime():
    app = create_app(config())
    service, auth = Mock(), Mock()
    principal = SimpleNamespace(user_id=1)
    allowed = {"reports.read", "sales.read", "debt.read", "inventory.read"}
    auth.get_current_user.side_effect = lambda _: SimpleNamespace(allowedFunctions=sorted(allowed))
    app.dependency_overrides[get_report_service] = lambda: service
    app.dependency_overrides[get_auth_service] = lambda: auth
    app.dependency_overrides[get_current_principal] = lambda: principal
    with TestClient(app) as client:
        yield client, service, allowed


@pytest.mark.parametrize(
    "kind,permission",
    [
        ("sales", "sales.read"),
        ("debt", "debt.read"),
        ("inventory", "inventory.read"),
        ("product-sales", "sales.read"),
        ("cash-and-credit", "debt.read"),
    ],
)
def test_every_report_has_both_grants_for_json_and_binary(runtime, kind, permission):
    client, service, allowed = runtime
    path = f"/api/v1/reports/{kind}?fromDate=2026-01-01&toDate=2026-02-01"
    for missing in ("reports.read", permission):
        allowed.remove(missing)
        for media in (
            "application/json",
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ):
            denied = client.get(path, headers={"Accept": media})
            assert denied.status_code == 403, denied.text
            service.read.assert_not_called()
        allowed.add(missing)


@pytest.mark.parametrize("kind", ["sales", "debt", "inventory", "product-sales", "cash-and-credit"])
def test_every_export_ignores_paging_and_releases_transaction_before_render(runtime, kind):
    client, service, _ = runtime
    dataset = {"kind": kind}
    service.read.return_value = dataset
    rendered = []

    def render(data, media):
        service.session.rollback.assert_called_once_with()
        assert data == dataset and media == "application/pdf"
        rendered.append(True)
        return b"%PDF-valid-test-output", media, {"Vary": "Accept", "Cache-Control": "no-store"}

    with patch("app.modules.reports.router.render_report", side_effect=render):
        result = client.get(
            f"/api/v1/reports/{kind}?fromDate=2026-01-01&toDate=2026-02-01"
            "&limit=not-an-integer&cursor=foreign&sort=not-a-sort",
            headers={"Accept": "application/pdf"},
        )
    assert result.status_code == 200 and rendered == [True]
    assert result.headers["Content-Type"] == "application/pdf"
    assert result.headers["Vary"] == "Accept"
    assert service.read.call_args.kwargs["export"] is True
    assert not {"limit", "sort", "cursor"} & service.read.call_args.kwargs.keys()


@pytest.mark.parametrize("query", ["limit=no", "limit=0", "limit=101"])
def test_json_page_size_is_validated_before_lookup(runtime, query):
    client, service, _ = runtime
    result = client.get("/api/v1/reports/sales?fromDate=2026-01-01&toDate=2026-02-01&" + query)
    assert result.status_code == 422
    service.read.assert_not_called()


def test_report_json_response_and_contract_preserve_all_filters(runtime):
    client, service, _ = runtime
    service.read.return_value = {
        "fromDate": "2026-01-01",
        "toDate": "2026-02-01",
        "generatedAt": "2026-02-01T00:00:00+00:00",
        "items": [],
        "pagination": {"limit": 1, "hasMore": False, "nextCursor": None},
        "totals": {
            "numberOfIssues": 0,
            "salesAmount": "0",
            "returnAmount": "0",
            "netSalesAmount": "0",
            "companyGrossSales": "900000000000000000000",
        },
    }
    result = client.get(
        "/api/v1/reports/sales?fromDate=2026-01-01&toDate=2026-02-01"
        "&agencyId=7&typeId=3&limit=1&cursor=opaque&sort=-salesAmount"
    )
    assert result.status_code == 200, result.text
    assert result.json()["totals"]["companyGrossSales"] == "900000000000000000000"
    assert service.read.call_args.kwargs["filters"] == {"agencyId": "7", "typeId": 3}
    assert service.read.call_args.kwargs["cursor"] == "opaque"
    assert result.headers["Cache-Control"] == "no-store"
    schema = client.get("/api/openapi.json").json()
    for kind in ("sales", "debt", "inventory", "product-sales", "cash-and-credit"):
        operation = schema["paths"][f"/api/v1/reports/{kind}"]["get"]
        assert "reports.read" in operation["x-permissions"]["allOf"]
        assert set(operation["responses"]["200"]["content"]) == {
            "application/json",
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        assert operation["responses"]["200"]["headers"]["Content-Disposition"]["schema"] == {
            "type": "string"
        }


def test_report_dependency_checks_limiter_and_uses_existing_signing_key():
    request, session = Mock(), Mock()
    request.app.state.settings = config()
    principal = SimpleNamespace(user_id=7)
    with patch("app.modules.reports.dependencies.check_business_limit") as limit:
        service = get_report_service(request, session, principal)
        limit.assert_called_once_with(request, 7)
    assert service.session is session and isinstance(service.codec, CursorCodec)


@pytest.mark.parametrize("kind", ["sales", "debt", "inventory", "product-sales", "cash-and-credit"])
def test_unauthenticated_reports_never_lookup_or_render_for_any_format(runtime, kind):
    client, service, _ = runtime

    def denied():
        raise AuthError(401, "UNAUTHENTICATED", "Authentication required")

    client.app.dependency_overrides[get_current_principal] = denied
    for media in (
        "application/json",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ):
        result = client.get(
            f"/api/v1/reports/{kind}?fromDate=2026-01-01&toDate=2026-02-01",
            headers={"Accept": media},
        )
        assert result.status_code == 401
        assert "Content-Disposition" not in result.headers
        assert result.headers["X-Request-Id"]
    service.read.assert_not_called()


def test_rate_limiter_and_safe_errors_prevent_partial_binary_response(runtime):
    client, service, _ = runtime
    request, session = Mock(), Mock()
    request.app.state.settings = config()
    failure = ApiError(429, "RATE_LIMITED", "Too many requests", headers={"Retry-After": "2"})
    with patch("app.modules.reports.dependencies.check_business_limit", side_effect=failure):
        with pytest.raises(ApiError) as error:
            get_report_service(request, session, SimpleNamespace(user_id=7))
        assert error.value.status == 429
    for media in ("application/json", "application/pdf"):
        for status, code in (
            (400, "INVALID_CURSOR"),
            (422, "VALIDATION_FAILED"),
            (429, "RATE_LIMITED"),
            (500, "INTERNAL_ERROR"),
        ):
            service.read.side_effect = ApiError(
                status,
                code,
                "Safe report error",
                headers={"Retry-After": "2"} if status == 429 else {},
            )
            result = client.get(
                "/api/v1/reports/sales?fromDate=2026-01-01&toDate=2026-02-01",
                headers={"Accept": media},
            )
            assert result.status_code == status and result.json()["code"] == code
            assert "Content-Disposition" not in result.headers
            assert result.headers["X-Request-Id"]
            if status == 429:
                assert result.headers["Retry-After"] == "2"
    service.session.rollback.assert_not_called()


def interrupt_binary_response(client, url, media):
    parsed = urlsplit(url)
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.4"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "root_path": "",
        "path": parsed.path,
        "raw_path": parsed.path.encode(),
        "query_string": parsed.query.encode(),
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
        "headers": [
            (name.lower(), value) for name, value in client.headers.raw if name.lower() != b"accept"
        ]
        + [(b"accept", media.encode())],
    }
    begun, delivered = [], []

    async def receive():
        if not delivered:
            delivered.append(True)
            return {"type": "http.request", "body": b"", "more_body": False}
        await anyio.Event().wait()

    async def send(message):
        if message["type"] == "http.response.start":
            begun.append(message)
        elif message["type"] == "http.response.body":
            raise ConnectionResetError("M30 deterministic ASGI client disconnect")

    with pytest.raises(ConnectionResetError, match="M30 deterministic ASGI"):
        client.portal.call(client.app, scope, receive, send)
    assert len(begun) == 1 and begun[0]["status"] == 200
    assert b"content-disposition" in dict(begun[0]["headers"])


def test_binary_disconnect_after_headers_has_already_released_read_transaction(runtime):
    client, service, _ = runtime
    service.read.return_value = dataset("debt", count=1)
    for media in (
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ):
        interrupt_binary_response(
            client, "/api/v1/reports/debt?fromDate=2026-01-01&toDate=2026-02-01", media
        )
    assert service.session.rollback.call_count == 2
