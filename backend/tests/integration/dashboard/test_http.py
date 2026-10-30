from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.core.exceptions import ApiError
from app.modules.dashboard.repository import DashboardRepository
from tests.integration.dashboard.test_dashboard import grants
from tests.integration.document_corrections.helpers import snapshot
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_normal_app_auth_projection_failures_readonly_and_session_revocation(engine, dashboard):
    client = dashboard.client
    path = "/api/v1/dashboard?month=2026-01"
    policy = {
        "agency.read": "agencies",
        "inventory.read": "inventory",
        "sales.read": "sales",
        "debt.read": "receivables",
        "stock.issue.post": "pendingIssueCount",
        "cash.upfront.verify": "verifiedUnreceiptedAmount",
    }
    for grant, section in policy.items():
        grants(engine, [grant])
        response = client.get(path)
        assert response.status_code == 200, response.text
        assert set(response.json()) == {"month", "asOf", section}
        assert response.headers["Cache-Control"] == "private, no-store"
        assert_schema(response.json(), "DashboardResponse")
    for allowed in ([], ["stock.issue.prepare"], ["cash.receipt.post"], ["reports.read"]):
        grants(engine, allowed)
        assert client.get(path).status_code == 403
    grants(engine, ["agency.read", "stock.issue.prepare", "cash.receipt.post"])
    before = snapshot(engine)
    assert set(client.get(path).json()) == {
        "month",
        "asOf",
        "agencies",
        "pendingIssueCount",
        "verifiedUnreceiptedAmount",
    }
    for request_path, expected in (
        ("/api/v1/dashboard", 422),
        (path.replace("2026-01", "0000-01"), 422),
    ):
        assert client.get(request_path).status_code == expected
    assert client.get(path, headers={"Authorization": "Basic invalid"}).status_code == 401
    with patch.object(
        DashboardRepository, "agencies", side_effect=RuntimeError("private sentinel")
    ):
        failure = client.get(path)
    assert failure.status_code == 500 and "private sentinel" not in failure.text
    assert_schema(failure.json(), "Error")
    with patch.object(
        client.app.state.auth_limiter,
        "check",
        side_effect=ApiError(429, "RATE_LIMITED", "Rate limited", headers={"Retry-After": "1"}),
    ):
        limited = client.get(path)
    assert limited.status_code == 429 and limited.headers["Retry-After"] == "1"
    assert_schema(limited.json(), "Error")
    assert snapshot(engine) == before
    with engine.begin() as connection:
        connection.execute(
            text("""UPDATE dms.auth_token SET "revokedAt"=clock_timestamp()
            WHERE purpose='REFRESH' AND "revokedAt" IS NULL""")
        )
    assert client.get(path).status_code == 401
    assert engine.pool.checkedout() == 0
