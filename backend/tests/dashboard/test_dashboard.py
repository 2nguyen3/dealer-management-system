from datetime import UTC, datetime, timedelta
from decimal import Decimal
from itertools import combinations
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.sql.elements import TextClause

from app.core.config import Settings
from app.core.exceptions import ApiError, AuthError
from app.main import create_app
from app.modules.auth.tokens import decode_access_token, encode_access_token
from app.modules.dashboard.dependencies import get_dashboard_service
from app.modules.dashboard.repository import DashboardRepository
from app.modules.dashboard.schemas import DashboardResponse
from app.modules.dashboard.service import ADMISSION, DashboardService, month_bounds
from tests.support.contract import SOURCE, assert_schema
from tests.workflows.test_contract import (
    test_owning_operations_match_canonical_contract as check_contract,
)

NOW = datetime(2026, 10, 28, 10, tzinfo=UTC)
READERS = (
    "agency.read",
    "inventory.read",
    "sales.read",
    "debt.read",
    "stock.issue.post",
    "cash.upfront.verify",
    "stock.issue.prepare",
    "cash.receipt.post",
)
EXAMPLE = SOURCE["components"]["examples"]["Dashboard"]["value"]


@pytest.fixture
def environment(monkeypatch):
    engine, connection, session = MagicMock(), MagicMock(), MagicMock()
    engine.connect.return_value.__enter__.return_value = connection
    connection.execution_options.return_value = connection
    session.__enter__.return_value = session
    session.scalar.return_value = NOW
    auth, repo = Mock(), Mock()
    auth.authenticate.return_value = "fresh-principal"
    auth.get_current_user.return_value.allowedFunctions = []
    for method, section in (
        ("agencies", "agencies"),
        ("inventory", "inventory"),
        ("sales", "sales"),
        ("receivables", "receivables"),
        ("pending", "pendingIssueCount"),
        ("verified", "verifiedUnreceiptedAmount"),
    ):
        getattr(repo, method).return_value = EXAMPLE[section]
    auth_factory, repo_factory = Mock(return_value=auth), Mock(return_value=repo)
    session_factory = Mock(return_value=session)
    monkeypatch.setattr("app.modules.dashboard.service.Session", session_factory)
    monkeypatch.setattr("app.modules.dashboard.service.AuthService", auth_factory)
    monkeypatch.setattr("app.modules.dashboard.service.DashboardRepository", repo_factory)
    preflight = Mock()
    monkeypatch.setattr("app.modules.dashboard.service.decode_access_token", preflight)
    service = DashboardService(engine, "settings", "delivery")
    return SimpleNamespace(**locals())


@pytest.mark.parametrize(
    "allowed", [subset for size in range(9) for subset in combinations(READERS, size)]
)
def test_all_permission_subsets_exact_admission_and_projection(environment, allowed):
    env = environment
    env.auth.get_current_user.return_value.allowedFunctions = list(allowed)
    if not set(allowed).intersection(READERS[:6]):
        with pytest.raises(AuthError) as error:
            env.service.get("raw-token", "2026-10")
        assert error.value.status == 403
        env.repo_factory.assert_not_called()
        return
    result = env.service.get("raw-token", "2026-10").model_dump(mode="json")
    expected = {"month", "asOf"}
    policy = {
        "agencies": ("agencies", {"agency.read"}),
        "inventory": ("inventory", {"inventory.read"}),
        "sales": ("sales", {"sales.read"}),
        "receivables": ("receivables", {"debt.read"}),
        "pendingIssueCount": ("pending", {"stock.issue.post", "stock.issue.prepare"}),
        "verifiedUnreceiptedAmount": ("verified", {"cash.upfront.verify", "cash.receipt.post"}),
    }
    for section, (method, readers) in policy.items():
        enabled = bool(set(allowed).intersection(readers))
        assert getattr(env.repo, method).call_count == int(enabled)
        if enabled:
            expected.add(section)
    assert set(result) == expected
    assert_schema(result, "DashboardResponse")


@pytest.mark.parametrize("allowed", [[], ["reports.read"], ["MANAGEMENT"], ["payments.online"]])
def test_unrelated_grants_do_not_admit(environment, allowed):
    environment.auth.get_current_user.return_value.allowedFunctions = allowed
    with pytest.raises(AuthError):
        environment.service.get("token", "2026-10")


def test_snapshot_boundary_fresh_auth_and_next_request_revocation(environment):
    env = environment
    order = []
    env.preflight.side_effect = lambda *args: order.append("preflight")
    env.connection.execution_options.side_effect = lambda **kw: (
        order.append("isolation") or env.connection
    )
    env.session.scalar.side_effect = lambda sql: order.append("snapshot") or NOW
    env.auth.authenticate.side_effect = lambda token: order.append("authenticate") or token
    env.auth.get_current_user.side_effect = lambda principal: (
        order.append("grants") or SimpleNamespace(allowedFunctions=["agency.read"])
    )
    env.repo.agencies.side_effect = lambda: order.append("metric") or EXAMPLE["agencies"]
    result = env.service.get("raw", "2026-10")
    assert order == ["preflight", "isolation", "snapshot", "authenticate", "grants", "metric"]
    assert result.asOf == NOW
    env.connection.execution_options.assert_called_once_with(
        isolation_level="REPEATABLE READ", postgresql_readonly=True
    )
    env.auth_factory.assert_called_once_with(env.session, "settings", "delivery")
    env.repo_factory.assert_called_once_with(env.session)
    env.session.commit.assert_not_called()
    env.auth.get_current_user.side_effect = None
    env.auth.get_current_user.return_value.allowedFunctions = []
    with pytest.raises(AuthError):
        env.service.get("raw", "2026-10")


@pytest.mark.parametrize("kind", ["malformed", "expired", "signature", "valid"])
def test_invalid_jwt_is_rejected_before_database_allocation(environment, monkeypatch, kind):
    env = environment
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
    )
    env.service.settings = settings
    monkeypatch.setattr("app.modules.dashboard.service.decode_access_token", decode_access_token)
    now = datetime.now(UTC)
    issued = now - timedelta(hours=1) if kind == "expired" else now
    token, _ = encode_access_token(settings, 7, uuid4(), 1, issued + timedelta(hours=1), issued)
    if kind == "malformed":
        token = "not-a-jwt"
    elif kind == "signature":
        token = token.rsplit(".", 1)[0] + ".invalid-signature"
    env.auth.get_current_user.return_value.allowedFunctions = ["agency.read"]
    if kind == "valid":
        env.service.get(token, "2026-10")
        env.auth.authenticate.assert_called_once_with(token)
        env.engine.connect.assert_called_once()
        return
    with pytest.raises(AuthError) as error:
        env.service.get(token, "2026-10")
    assert error.value.status == 401 and error.value.code == "INVALID_OR_EXPIRED_TOKEN"
    env.engine.connect.assert_not_called()
    env.session_factory.assert_not_called()
    env.auth_factory.assert_not_called()
    env.repo_factory.assert_not_called()


def test_authenticated_business_limit_precedes_metrics_and_cleans_up(environment):
    env = environment
    env.auth.authenticate.return_value = SimpleNamespace(user_id=7)
    env.auth.get_current_user.return_value.allowedFunctions = ["agency.read"]
    env.service.limiter = Mock()
    env.service.get("raw", "2026-10")
    env.service.limiter.assert_called_once_with(7)
    env.repo_factory.reset_mock()
    env.service.limiter.side_effect = ApiError(429, "RATE_LIMITED", "Rate limited")
    with pytest.raises(ApiError) as error:
        env.service.get("raw", "2026-10")
    assert error.value.status == 429
    env.repo_factory.assert_not_called()
    assert env.session.__exit__.call_count == 2


@pytest.mark.parametrize("stage", ["authenticate", "grants", "query", "model"])
def test_failure_cleans_snapshot_and_never_returns_partial(environment, stage):
    env = environment
    env.auth.get_current_user.return_value.allowedFunctions = ["agency.read"]
    if stage == "authenticate":
        env.auth.authenticate.side_effect = AuthError(
            401, "INVALID_OR_EXPIRED_TOKEN", "Invalid token"
        )
    elif stage == "grants":
        env.auth.get_current_user.side_effect = RuntimeError("grants failed")
    elif stage == "query":
        env.repo.agencies.side_effect = RuntimeError("query failed")
    else:
        env.repo.agencies.return_value = {"total": -1, "active": 0}
    with pytest.raises((AuthError, RuntimeError, ValidationError)):
        env.service.get("raw", "2026-10")
    assert env.session.__exit__.call_count == 1
    assert env.connection.begin.return_value.__exit__.call_count == 1
    assert env.engine.connect.return_value.__exit__.call_count == 1


@pytest.mark.parametrize(
    "month", [None, "", " 2026-10", "2026-1", "2026-00", "2026-13", "0000-01", "10000-01"]
)
def test_invalid_month_does_not_connect(environment, month):
    with pytest.raises(ApiError) as error:
        environment.service.get("token", month)
    assert error.value.status == 422
    environment.engine.connect.assert_not_called()


@pytest.mark.parametrize(
    "month,start,end,length",
    [
        ("2026-10", "2025-11-01", "2026-11-01", 12),
        ("2024-02", "2023-03-01", "2024-03-01", 12),
        ("0001-01", "0001-01-01", "0001-02-01", 1),
        ("0001-11", "0001-01-01", "0001-12-01", 11),
        ("9999-12", "9999-01-01", "10000-01-01", 12),
    ],
)
def test_month_bounds_calendar_edges(month, start, end, length):
    bounds, months = month_bounds(month)
    assert bounds["trendStart"] == start
    assert bounds["end"] == end
    assert len(months) == length and months[-1] == month and months == sorted(months)
    assert bounds["receivedStart"] == f"{month}-01T00:00:00+07:00"
    assert bounds["receivedEnd"] == f"{end}T00:00:00+07:00"


def test_schema_exact_numbers_limits_and_omission():
    data = DashboardResponse.model_validate(EXAMPLE).model_dump(mode="json")
    assert_schema(data, "DashboardResponse")
    assert set(DashboardResponse(month="2026-10", asOf=NOW).model_dump()) == {"month", "asOf"}
    for section, field, value in (
        ("sales", "gross", 2),
        ("sales", "net", "1.2"),
        ("inventory", "productCount", True),
        ("agencies", "active", -1),
        ("sales", "topProducts", [EXAMPLE["sales"]["topProducts"][0]] * 11),
        ("sales", "monthlyTrend", [EXAMPLE["sales"]["monthlyTrend"][0]] * 13),
        ("receivables", "topAgencies", [EXAMPLE["receivables"]["topAgencies"][0]] * 11),
    ):
        with pytest.raises(ValidationError):
            DashboardResponse.model_validate(
                {"month": "2026-10", "asOf": NOW, section: EXAMPLE[section] | {field: value}}
            )
    big = "123456789012345678901234567890123456789"
    result = DashboardResponse(month="2026-10", asOf=NOW, verifiedUnreceiptedAmount=big)
    assert result.model_dump(mode="json")["verifiedUnreceiptedAmount"] == big


@pytest.mark.parametrize(
    "kind,field,value",
    [
        ("product", "productId", 1),
        ("product", "unitId", "1"),
        ("product", "unitId", True),
        ("product", "soldQuantity", "0.0001"),
        ("agency", "currentDebt", "1000000000000000000"),
        ("agency", "agencyId", "9223372036854775808"),
    ],
)
def test_nested_row_identity_and_numeric_storage_bounds(kind, field, value):
    if kind == "product":
        section = {
            "sales": EXAMPLE["sales"]
            | {"topProducts": [EXAMPLE["sales"]["topProducts"][0] | {field: value}]}
        }
    else:
        section = {
            "receivables": EXAMPLE["receivables"]
            | {"topAgencies": [EXAMPLE["receivables"]["topAgencies"][0] | {field: value}]}
        }
    with pytest.raises(ValidationError):
        DashboardResponse(month="2026-10", asOf=NOW, **section)


def test_owned_dependency_uses_existing_engine_without_request_session():
    state = SimpleNamespace(engine=object(), settings=object(), reset_delivery=object())
    service = get_dashboard_service(SimpleNamespace(app=SimpleNamespace(state=state)))
    assert service.engine is state.engine and service.settings is state.settings
    assert service.delivery is state.reset_delivery


def test_repository_every_metric_real_sql_and_bound_values():
    session = Mock()
    session.execute.return_value.mappings.return_value.one.return_value = {"value": 1}
    session.execute.return_value.mappings.return_value.__iter__ = Mock(return_value=iter([]))
    repo = DashboardRepository(session)
    bounds, months = month_bounds("2026-10")
    repo.agencies()
    repo.inventory(bounds)
    repo.receivables(bounds)
    repo.pending()
    repo.verified(bounds)
    statements = [str(call.args[0]) for call in session.execute.call_args_list]
    assert all(isinstance(call.args[0], TextClause) for call in session.execute.call_args_list)
    assert any('b."currentStock"<p."lowStockThreshold"' in sql for sql in statements)
    assert any("d.kind='STOCK_RECEIPT'" in sql for sql in statements)
    assert any("d.kind IN ('PAYMENT_RECEIPT','REFUND')" in sql for sql in statements)
    assert any('ORDER BY b."currentDebt" DESC,a.id ASC LIMIT 10' in sql for sql in statements)
    pending = str(session.scalar.call_args_list[0].args[0])
    verified = str(session.scalar.call_args_list[1].args[0])
    assert "d.status='PENDING' AND r.state='READY'" in pending and ":start" not in pending
    assert '"receiptDocumentId" IS NULL' in verified and "state='VERIFIED'" in verified
    assert "currentRevisionId" not in verified and '"receivedAt"<' in verified
    assert session.scalar.call_args_list[1].args[1] == bounds
    session.commit.assert_not_called()
    session.rollback.assert_not_called()


def test_sales_sql_grouping_zero_buckets_exact_net_and_full_top_rows():
    session = Mock()
    big = Decimal("123456789012345678901234567890123456789")
    trend_rows = [{"month": "2026-10", "gross": big, "returns": Decimal(1)}]
    product = EXAMPLE["sales"]["topProducts"][0]
    session.execute.side_effect = [
        Mock(mappings=Mock(return_value=trend_rows)),
        Mock(mappings=Mock(return_value=[product])),
    ]
    bounds, months = month_bounds("2026-10")
    result = DashboardRepository(session).sales(bounds, months)
    assert len(result["monthlyTrend"]) == 12
    assert result["monthlyTrend"][0]["gross"] == Decimal(0)
    assert str(result["net"]) == "123456789012345678901234567890123456788"
    assert result["topProducts"] == [product]
    sql = str(session.execute.call_args_list[1].args[0])
    assert 'sum(l."returnAmount")' in sql and 'sum(l."lineAmount")' in sql
    assert 'GROUP BY l."productId"' in sql
    assert 'ORDER BY a."salesAmount" DESC,a."productId" ASC LIMIT 10' in sql
    assert session.execute.call_args_list[0].args[1] == bounds


def test_return_only_period_negative_net_and_empty_products():
    session = Mock()
    session.execute.side_effect = [
        Mock(
            mappings=Mock(
                return_value=[{"month": "2026-10", "gross": Decimal(0), "returns": Decimal(10)}]
            )
        ),
        Mock(mappings=Mock(return_value=[])),
    ]
    bounds, months = month_bounds("2026-10")
    result = DashboardRepository(session).sales(bounds, months)
    model = DashboardResponse(month="2026-10", asOf=NOW, sales=result)
    assert model.model_dump(mode="json")["sales"]["net"] == "-10"
    assert result["topProducts"] == []


def test_standalone_router_required_month_exact_policy_and_http_omission():
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
    )
    app = create_app(settings)
    service = Mock()
    service.get.return_value = DashboardResponse(month="2026-10", asOf=NOW, pendingIssueCount=2)
    app.dependency_overrides[get_dashboard_service] = lambda: service
    with TestClient(app) as client:
        assert client.get("/api/v1/dashboard?month=2026-10").status_code == 401
        assert (
            client.get(
                "/api/v1/dashboard?month=2026-10", headers={"Authorization": "Basic x"}
            ).status_code
            == 401
        )
        assert (
            client.get("/api/v1/dashboard", headers={"Authorization": "Bearer x"}).status_code
            == 422
        )
        assert (
            client.get(
                "/api/v1/dashboard?month=0000-01", headers={"Authorization": "Bearer x"}
            ).status_code
            == 422
        )
        response = client.get(
            "/api/v1/dashboard?month=2026-10", headers={"Authorization": "Bearer x"}
        )
        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "private, no-store"
        assert set(response.json()) == {"month", "asOf", "pendingIssueCount"}
        assert_schema(response.json(), "DashboardResponse")
        service.get.assert_called_once_with("x", "2026-10")
        document = client.get("/api/openapi.json").json()
        operation = document["paths"]["/api/v1/dashboard"]["get"]
        check_contract(document, "/dashboard", "get", SOURCE["paths"]["/dashboard"]["get"])
        assert operation["x-permissions"] == SOURCE["paths"]["/dashboard"]["get"]["x-permissions"]
        assert operation["x-permissions"]["anyOf"] == list(ADMISSION)
        assert next(p for p in operation["parameters"] if p["name"] == "month")["required"]
        service.get.side_effect = AuthError(403, "FORBIDDEN", "Permission denied")
        denied = client.get(
            "/api/v1/dashboard?month=2026-10", headers={"Authorization": "Bearer x"}
        )
        assert denied.status_code == 403 and "sales" not in denied.json()
        service.get.side_effect = RuntimeError("secret-sentinel")
    with TestClient(app, raise_server_exceptions=False) as client:
        failed = client.get(
            "/api/v1/dashboard?month=2026-10", headers={"Authorization": "Bearer x"}
        )
        assert failed.status_code == 500 and "secret-sentinel" not in failed.text
