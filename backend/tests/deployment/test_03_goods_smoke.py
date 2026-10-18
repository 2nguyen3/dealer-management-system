import os
from uuid import uuid4

import httpx
import pytest

from app.db.seed import DEMO_USERS
from tests.support.contract import assert_schema

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
def test_receipt_lifecycle_and_inventory_direct_and_nginx(variable):
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
        product = client.post(
            "/api/v1/products", json={"name": "Receipt smoke " + uuid4().hex, "unitId": 1}
        )
        assert product.status_code == 201
        product_id = product.json()["id"]
        headers = {"Idempotency-Key": str(uuid4())}
        body = {
            "businessDate": "2026-10-05",
            "lines": [{"productId": product_id, "quantity": "2", "unitPrice": "100"}],
        }
        created = client.post("/api/v1/stock-receipts", json=body, headers=headers)
        assert created.status_code == 201, created.text
        assert_schema(created.json(), "DocumentMutationResult")
        path = created.headers["Location"]
        assert (
            client.post("/api/v1/stock-receipts", json=body, headers=headers).json()
            == created.json()
        )
        detail = client.get(path)
        assert detail.headers["ETag"] == created.headers["ETag"]
        assert_schema(detail.json(), "StockReceipt")
        patched = client.patch(
            path, json={"note": "Smoke verified"}, headers={"If-Match": detail.headers["ETag"]}
        )
        assert patched.status_code == 200
        post_headers = {"If-Match": patched.headers["ETag"], "Idempotency-Key": str(uuid4())}
        posted = client.post(path + "/post", headers=post_headers)
        assert posted.status_code == 200, posted.text
        assert posted.json()["inventoryChanges"][0]["currentStock"] == "2"
        assert client.post(path + "/post", headers=post_headers).json() == posted.json()
        statement = client.get(f"/api/v1/products/{product_id}/inventory-entries")
        assert statement.status_code == 200 and statement.json()["closingStock"] == "2"
        assert_schema(statement.json(), "InventoryStatement")
        page = client.get("/api/v1/stock-receipts", params={"productId": product_id})
        assert page.status_code == 200 and len(page.json()["items"]) == 1
        assert client.get(path).headers["ETag"] == posted.headers["ETag"]
        assert client.get(
            "/api/v1/audit-logs", params={"requestId": posted.headers["X-Request-Id"]}
        ).json()["items"]
