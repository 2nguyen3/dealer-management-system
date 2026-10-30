import os

import httpx
import pytest

from app.db.seed import DEMO_USERS
from tests.support.contract import SOURCE, assert_schema

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["M31_DIRECT_URL", "M31_PROXY_URL", "M31_PUBLIC_URL"])
def test_dashboard_publication_reconciles_reports_without_mutating_business_data(variable):
    base = os.environ.get(variable)
    if not base:
        pytest.fail("Explicit existing development URL required")
    with httpx.Client(
        base_url=base,
        timeout=90,
        headers={"ngrok-skip-browser-warning": "true", "Origin": "http://localhost:5173"},
    ) as client:
        assert client.get("/api/v1/health/ready").status_code == 200
        schema = client.get("/api/openapi.json").json()
        operations = [
            operation["operationId"]
            for path, methods in schema["paths"].items()
            if not path.startswith("/api/v1/health")
            for method, operation in methods.items()
            if method in {"get", "post", "put", "patch", "delete"}
        ]
        canonical = {
            operation["operationId"]
            for methods in SOURCE["paths"].values()
            for operation in methods.values()
            if isinstance(operation, dict) and "operationId" in operation
        }
        assert len(operations) == len(set(operations)) == 153
        assert canonical - set(operations) == {"queryChatbot"}
        path = "/api/v1/dashboard"
        assert client.get(path, params={"month": "2026-09"}).status_code == 401
        login = client.post(
            "/api/v1/auth/login", json={"email": DEMO_USERS[0][0], "password": DEMO_USERS[0][3]}
        )
        assert login.status_code == 200
        credentials = login.json()
        client.headers["Authorization"] = "Bearer " + credentials["accessToken"]
        try:
            response = client.get(path, params={"month": "2026-09"})
            assert response.status_code == 200, response.text
            actual = response.json()
            assert_schema(actual, "DashboardResponse")
            assert set(actual) == {
                "month",
                "asOf",
                "agencies",
                "inventory",
                "sales",
                "receivables",
                "pendingIssueCount",
                "verifiedUnreceiptedAmount",
            }
            assert response.headers["Cache-Control"] == "private, no-store"
            assert response.headers.get("X-Request-Id")
            assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
            assert [point["month"] for point in actual["sales"]["monthlyTrend"]] == [
                *[f"2025-{month:02}" for month in range(10, 13)],
                *[f"2026-{month:02}" for month in range(1, 10)],
            ]
            assert actual["sales"]["monthlyTrend"][-1] == {
                "month": "2026-09",
                **{key: actual["sales"][key] for key in ("gross", "returns", "net")},
            }
            params = {"fromDate": "2026-09-01", "toDate": "2026-10-01"}
            sales = client.get("/api/v1/reports/sales", params=params)
            cash = client.get("/api/v1/reports/cash-and-credit", params=params)
            assert sales.status_code == cash.status_code == 200
            for dashboard_key, report_key in (
                ("gross", "salesAmount"),
                ("returns", "returnAmount"),
                ("net", "netSalesAmount"),
            ):
                assert actual["sales"][dashboard_key] == sales.json()["totals"][report_key]
            for key in ("cashReceived", "cashRefunded"):
                assert actual["receivables"][key] == cash.json()["totals"][key]
            assert int(actual["receivables"]["currentCredit"]) == (
                int(cash.json()["totals"]["currentReservedCredit"])
                + int(cash.json()["totals"]["currentAvailableCredit"])
            )
            assert (
                actual["verifiedUnreceiptedAmount"]
                == cash.json()["totals"]["verifiedUnreceiptedAmount"]
            )
            assert actual["agencies"]["total"] == 30 and actual["inventory"]["productCount"] == 24
            for month in ("0001-01", "9999-12"):
                boundary = client.get(path, params={"month": month})
                assert boundary.status_code == 200
                assert_schema(boundary.json(), "DashboardResponse")
            for params in ({}, {"month": "0000-01"}, {"month": "2026-13"}):
                assert client.get(path, params=params).status_code == 422
            wrong_method = client.post(path, params={"month": "2026-09"})
            assert wrong_method.status_code == 405 and "GET" in wrong_method.headers["Allow"]
        finally:
            assert (
                client.post(
                    "/api/v1/auth/logout", json={"refreshToken": credentials["refreshToken"]}
                ).status_code
                == 204
            )
