import os
from decimal import ROUND_HALF_UP, Decimal
from uuid import uuid4

import httpx
import pytest

from app.db.seed import DEMO_USERS
from tests.support.contract import assert_schema

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
def test_credit_application_no_new_cash(variable):
    base = os.environ.get(variable)
    if not base or not base.startswith("http://127.0.0.1:"):
        pytest.fail("Deployment smoke requires explicit disposable loopback URL")
    with httpx.Client(base_url=base, timeout=90) as client:
        login = client.post(
            "/api/v1/auth/login", json={"email": DEMO_USERS[0][0], "password": DEMO_USERS[0][3]}
        )
        assert login.status_code == 200, login.text
        client.headers["Authorization"] = "Bearer " + login.json()["accessToken"]

        def create(path, body):
            response = client.post(path, json=body, headers={"Idempotency-Key": str(uuid4())})
            assert response.status_code == 201, response.text
            return response

        def action(created, suffix, token=None):
            response = client.post(
                created.headers["Location"] + "/" + suffix,
                headers={
                    "If-Match": token or created.headers["ETag"],
                    "Idempotency-Key": str(uuid4()),
                },
            )
            assert response.status_code == 200, response.text
            return response

        name = "M25_" + uuid4().hex
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
        receipt = create(
            "/api/v1/stock-receipts",
            {
                "businessDate": "2026-10-01",
                "lines": [
                    {"productId": product.json()["id"], "quantity": "10", "unitPrice": "100"}
                ],
            },
        )
        action(receipt, "post")

        def sale(day):
            value = create(
                "/api/v1/stock-issues",
                {
                    "agencyId": agency.json()["id"],
                    "businessDate": day,
                    "lines": [{"productId": product.json()["id"], "quantity": "1"}],
                },
            )
            ready = action(value, "submit")
            action(value, "post", ready.headers["ETag"])
            return value

        first = sale("2026-10-02")
        price = (
            Decimal(100) * Decimal(client.get("/api/v1/business-rules").json()["sellingPriceRate"])
        ).quantize(Decimal(1), rounding=ROUND_HALF_UP)
        cash = create(
            "/api/v1/payment-receipts",
            {
                "agencyId": agency.json()["id"],
                "businessDate": "2026-10-03",
                "amount": str(price),
                "paymentMethod": "CASH",
            },
        )
        action(cash, "post")
        line = client.get(first.headers["Location"]).json()["currentRevision"]["lines"][0]
        returned = create(
            "/api/v1/sales-returns",
            {
                "originDocumentId": first.json()["id"],
                "businessDate": "2026-10-04",
                "lines": [{"originLineId": line["id"], "quantity": "1"}],
            },
        )
        action(returned, "post")
        sale("2026-10-05")
        application = create(
            "/api/v1/credit-applications",
            {"agencyId": agency.json()["id"], "businessDate": "2026-10-06", "amount": str(price)},
        )
        posted = action(application, "post")
        assert_schema(posted.json(), "DocumentMutationResult")
        assert posted.json()["agencyBalance"]["currentDebt"] == "0"
        assert posted.json()["agencyBalance"]["currentCredit"] == "0"
        detail = client.get(application.headers["Location"])
        assert_schema(detail.json(), "CreditApplication")
        assert detail.json()["cashReceived"] == "0"
        receipts = client.get("/api/v1/payment-receipts", params={"agencyId": agency.json()["id"]})
        assert [item["id"] for item in receipts.json()["items"]] == [cash.json()["id"]]
