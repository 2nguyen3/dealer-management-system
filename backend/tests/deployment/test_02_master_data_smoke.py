import os
from uuid import uuid4

import httpx
import pytest

from app.db.seed import DEMO_USERS

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
def test_permissions_audit_rules_products_agencies_direct_and_nginx(variable):
    base = os.environ.get(variable)
    if not base or not base.startswith("http://127.0.0.1:"):
        pytest.fail("Deployment smoke requires explicit disposable loopback URL")
    email, _, _, password, _ = DEMO_USERS[0]
    with httpx.Client(
        base_url=base, timeout=float(os.getenv("AUTH_SMOKE_TIMEOUT_SECONDS", "10"))
    ) as client:
        login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200
        client.headers["Authorization"] = "Bearer " + login.json()["accessToken"]
        functions = client.get("/api/v1/functions", params={"limit": 100})
        assert functions.status_code == 200 and len(functions.json()["items"]) == 33
        code = "SMOKE_" + uuid4().hex
        group = client.post("/api/v1/user-groups", json={"code": code, "name": code})
        permission_path = group.headers["Location"] + "/permissions/1"
        permission = client.put(
            permission_path, json={"isAllowed": True}, headers={"If-None-Match": "*"}
        )
        assert permission.status_code == 201
        assert (
            client.put(
                permission_path,
                json={"isAllowed": False},
                headers={"If-Match": permission.headers["ETag"]},
            ).status_code
            == 200
        )
        assert (
            client.delete(
                group.headers["Location"], headers={"If-Match": group.headers["ETag"]}
            ).status_code
            == 204
        )
        audit = client.get(
            "/api/v1/audit-logs", params={"requestId": permission.headers["X-Request-Id"]}
        )
        assert (
            audit.status_code == 200
            and audit.json()["items"][0]["functionCode"] == "permissions.manage"
        )
        assert client.get("/api/v1/audit-logs/" + audit.json()["items"][0]["id"]).status_code == 200
        rules = client.get("/api/v1/business-rules")
        assert (
            client.patch(
                "/api/v1/business-rules",
                json={"sellingPriceRate": rules.json()["sellingPriceRate"]},
                headers={"If-Match": rules.headers["ETag"]},
            ).status_code
            == 200
        )
        product = client.post("/api/v1/products", json={"name": code, "unitId": 1})
        assert product.status_code == 201 and product.json()["currentStock"] == "0"
        assert (
            client.delete(
                product.headers["Location"], headers={"If-Match": product.headers["ETag"]}
            ).status_code
            == 204
        )
        district = client.post("/api/v1/districts", json={"code": code, "name": code})
        agency = client.post(
            "/api/v1/agencies",
            json={
                "name": code,
                "typeId": 1,
                "districtId": district.json()["id"],
                "email": "smoke@example.com",
                "acceptedDate": "2026-10-04",
            },
        )
        assert agency.status_code == 201 and agency.json()["currentDebt"] == "0"
        headers = {"If-Match": agency.headers["ETag"], "Idempotency-Key": str(uuid4())}
        terminated = client.post(
            agency.headers["Location"] + "/terminate", json={"reason": "Smoke"}, headers=headers
        )
        assert terminated.status_code == 200 and terminated.json()["status"] == "TERMINATED"
        assert (
            client.post(
                agency.headers["Location"] + "/terminate", json={"reason": "Smoke"}, headers=headers
            ).json()
            == terminated.json()
        )
        assert (
            client.delete(
                agency.headers["Location"], headers={"If-Match": terminated.headers["ETag"]}
            ).status_code
            == 204
        )
        assert (
            client.delete(
                district.headers["Location"], headers={"If-Match": district.headers["ETag"]}
            ).status_code
            == 204
        )
