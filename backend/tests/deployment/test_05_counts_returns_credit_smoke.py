import os
from decimal import ROUND_HALF_UP, Decimal
from uuid import uuid4

import httpx
import pytest

from app.db.seed import DEMO_USERS
from tests.support.contract import assert_schema

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
def test_adjustment_count_return_credit_atomic_workflow(variable):
    base = os.environ.get(variable)
    if not base or not base.startswith("http://127.0.0.1:"):
        pytest.fail("Deployment smoke requires explicit disposable loopback URL")
    with httpx.Client(
        base_url=base, timeout=float(os.getenv("AUTH_SMOKE_TIMEOUT_SECONDS", "90"))
    ) as client:
        login = client.post(
            "/api/v1/auth/login", json={"email": DEMO_USERS[0][0], "password": DEMO_USERS[0][3]}
        )
        assert login.status_code == 200, login.text
        client.headers["Authorization"] = "Bearer " + login.json()["accessToken"]
        name = "COUNT_" + uuid4().hex
        district = client.post("/api/v1/districts", json={"code": name, "name": name})
        assert district.status_code == 201, district.text
        agency = client.post(
            "/api/v1/agencies",
            json={
                "name": name,
                "typeId": 1,
                "districtId": district.json()["id"],
                "email": "smoke@example.com",
                "acceptedDate": "2026-10-01",
            },
        )
        assert agency.status_code == 201, agency.text
        product = client.post("/api/v1/products", json={"name": name, "unitId": 1})
        assert product.status_code == 201, product.text
        product_id = product.json()["id"]

        def create(path, body):
            response = client.post(path, json=body, headers={"Idempotency-Key": str(uuid4())})
            assert response.status_code == 201, response.text
            return response

        def action(response, suffix):
            path = response.headers.get("Location", f"/api/v1/stock-counts/{response.json()['id']}")
            result = client.post(
                path + "/" + suffix,
                headers={"If-Match": response.headers["ETag"], "Idempotency-Key": str(uuid4())},
            )
            assert result.status_code == 200, result.text
            return result

        receipt = create(
            "/api/v1/stock-receipts",
            {
                "businessDate": "2026-10-01",
                "lines": [{"productId": product_id, "quantity": "10", "unitPrice": "100"}],
            },
        )
        action(receipt, "post")
        adjustment = create(
            "/api/v1/stock-adjustments",
            {
                "businessDate": "2026-10-02",
                "reason": "Warehouse damage",
                "lines": [{"productId": product_id, "quantity": "-1"}],
            },
        )
        adjusted = action(adjustment, "post")
        assert (
            adjusted.json()["totalAmount"] == "0"
            and adjusted.json()["inventoryChanges"][0]["currentStock"] == "9"
        )
        count = create(
            "/api/v1/stock-counts",
            {
                "countedAt": "2026-10-03T01:00:00Z",
                "reason": "Physical shortage",
                "lines": [{"productId": product_id, "countedQuantity": "8"}],
            },
        )
        confirmed = action(count, "confirm")
        assert_schema(confirmed.json(), "StockCount")
        assert confirmed.json()["adjustmentDocumentId"] is not None
        sale = create(
            "/api/v1/stock-issues",
            {
                "agencyId": agency.json()["id"],
                "businessDate": "2026-10-04",
                "lines": [{"productId": product_id, "quantity": "2"}],
            },
        )
        ready = action(sale, "submit")
        posted = client.post(
            sale.headers["Location"] + "/post",
            headers={"If-Match": ready.headers["ETag"], "Idempotency-Key": str(uuid4())},
        )
        assert posted.status_code == 200, posted.text
        detail = client.get(sale.headers["Location"])
        price = (
            Decimal(100) * Decimal(client.get("/api/v1/business-rules").json()["sellingPriceRate"])
        ).quantize(Decimal(1), rounding=ROUND_HALF_UP)
        assert Decimal(posted.json()["totalAmount"]) == 2 * price
        payment = create(
            "/api/v1/payment-receipts",
            {
                "agencyId": agency.json()["id"],
                "businessDate": "2026-10-05",
                "amount": posted.json()["totalAmount"],
                "paymentMethod": "CASH",
            },
        )
        action(payment, "post")
        returned = create(
            "/api/v1/sales-returns",
            {
                "originDocumentId": sale.json()["id"],
                "businessDate": "2026-10-06",
                "lines": [
                    {
                        "originLineId": detail.json()["currentRevision"]["lines"][0]["id"],
                        "quantity": "1",
                    }
                ],
            },
        )
        returned_post = action(returned, "post")
        assert Decimal(returned_post.json()["totalAmount"]) == price
        assert returned_post.json()["inventoryChanges"][0]["currentStock"] == "7"
        lots = client.get(
            agency.headers["Location"] + "/credit-lots", params={"availableOnly": True}
        )
        assert lots.status_code == 200, lots.text
        assert lots.json()["items"][0]["originReceiptId"] == payment.json()["id"]
        assert Decimal(lots.json()["items"][0]["available"]) == price
        statement = client.get(agency.headers["Location"] + "/credit-entries")
        assert statement.status_code == 200, statement.text
        assert_schema(statement.json(), "CreditStatement")
        assert Decimal(statement.json()["closingCredit"]) == price
        balance = client.get(agency.headers["Location"] + "/balance").json()
        assert balance["currentDebt"] == "0" and Decimal(balance["availableCredit"]) == price
