"""Non-mutating publication checks on explicitly selected existing development URLs."""

import os
from uuid import uuid4

import httpx
import pytest

from tests.support.contract import SOURCE

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["M29_DIRECT_URL", "M29_PROXY_URL", "M29_PUBLIC_URL"])
def test_all_correction_operations_are_published(variable):
    base = os.environ.get(variable)
    if not base:
        pytest.fail("Explicit existing development URL required")
    with httpx.Client(
        base_url=base, timeout=30, headers={"ngrok-skip-browser-warning": "true"}
    ) as client:
        ready = client.get("/api/v1/health/ready")
        assert ready.status_code == 200 and ready.json() == {"status": "ok"}
        specification = client.get("/api/openapi.json")
        assert specification.status_code == 200
        paths = specification.json()["paths"]
        operations = [
            operation["operationId"]
            for methods in paths.values()
            for method, operation in methods.items()
            if method in {"get", "post", "patch", "put", "delete"}
        ]
        assert len(operations) == len(set(operations))
        canonical = {
            operation["operationId"]
            for methods in SOURCE["paths"].values()
            for operation in methods.values()
            if isinstance(operation, dict) and "operationId" in operation
        }
        published = {
            operation["operationId"]
            for path, methods in paths.items()
            if not path.startswith("/api/v1/health")
            for method, operation in methods.items()
            if method in {"get", "post", "patch", "put", "delete"}
        }
        unpublished_read_products = {
            operation["operationId"]
            for path, methods in SOURCE["paths"].items()
            if path.startswith(("/reports/", "/dashboard", "/chatbot/"))
            for operation in methods.values()
            if isinstance(operation, dict) and "operationId" in operation
        }
        assert published <= canonical
        assert canonical - published <= unpublished_read_products
        for owner in (
            "stock-receipts",
            "stock-adjustments",
            "payment-receipts",
            "stock-issues",
            "sales-returns",
            "credit-applications",
        ):
            for action in ("corrections", "cancel"):
                path = f"/api/v1/{owner}/{{documentId}}/{action}"
                assert "post" in paths[path]
                denied = client.post(
                    path.replace("{documentId}", "999999999"),
                    json={"reason": "Unauthenticated transport probe"},
                    headers={"If-Match": '"synthetic"', "Idempotency-Key": str(uuid4())},
                )
                assert denied.status_code == 401, denied.text
                assert denied.headers.get("X-Request-Id")
        assert paths["/api/v1/dashboard"]["get"]["operationId"] == "getDashboard"
        assert "/api/v1/chatbot/queries" not in paths
        options = client.options(
            "/api/v1/payment-receipts/999999999/cancel",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,if-match,idempotency-key",
            },
        )
        assert options.status_code == 200
        assert options.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
