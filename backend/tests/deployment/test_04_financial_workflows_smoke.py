import os
from uuid import uuid4

import httpx
import pytest

from app.db.seed import DEMO_USERS
from tests.support.contract import assert_schema

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
def test_issue_upfront_manual_receipt_and_financial_reads_direct_and_proxy(variable):
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
        name = "FIN_" + uuid4().hex
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

        def create(path, body):
            result = client.post(path, json=body, headers={"Idempotency-Key": str(uuid4())})
            assert result.status_code == 201, result.text
            return result

        def action(path, etag):
            result = client.post(path, headers={"If-Match": etag, "Idempotency-Key": str(uuid4())})
            assert result.status_code == 200, result.text
            return result

        incoming = create(
            "/api/v1/stock-receipts",
            {
                "businessDate": "2026-10-01",
                "lines": [
                    {"productId": product.json()["id"], "quantity": "10", "unitPrice": "100"}
                ],
            },
        )
        action(incoming.headers["Location"] + "/post", incoming.headers["ETag"])
        issue = create(
            "/api/v1/stock-issues",
            {
                "agencyId": agency.json()["id"],
                "businessDate": "2026-10-02",
                "immediatePayment": "100",
                "lines": [{"productId": product.json()["id"], "quantity": "2"}],
            },
        )
        ready = action(issue.headers["Location"] + "/submit", issue.headers["ETag"])
        evidence = create(
            "/api/v1/upfront-confirmations",
            {
                "issueRevisionId": ready.json()["revisionId"],
                "amount": "100",
                "method": "BANK_TRANSFER",
                "receivedAt": "2026-10-02T01:00:00Z",
            },
        )
        detail = client.get(issue.headers["Location"])
        posted = action(issue.headers["Location"] + "/post", detail.headers["ETag"])
        assert posted.json()["autoReceiptId"] is not None
        assert client.get(evidence.headers["Location"]).json()["state"] == "CONSUMED"
        amount = posted.json()["remainingAtIssue"]
        payment = create(
            "/api/v1/payment-receipts",
            {
                "agencyId": agency.json()["id"],
                "businessDate": "2026-10-03",
                "amount": amount,
                "paymentMethod": "CASH",
            },
        )
        paid = action(payment.headers["Location"] + "/post", payment.headers["ETag"])
        assert paid.json()["agencyBalance"]["currentDebt"] == "0"
        assert_schema(paid.json(), "DocumentMutationResult")
        balance = client.get(issue.headers["Location"] + "/balance")
        assert balance.json()["settlementStatus"] == "SETTLED"
        statement = client.get(agency.headers["Location"] + "/receivable-entries")
        assert statement.json()["closingDebt"] == "0"
        assert_schema(statement.json(), "ReceivableStatement")
        allocations = client.get("/api/v1/documents/" + payment.json()["id"] + "/allocations")
        assert allocations.json()["items"][0]["issueDocumentId"] == issue.json()["id"]
        overview = client.get("/api/v1/receivables", params={"agencyId": agency.json()["id"]})
        assert overview.json()["totals"]["currentDebt"] == "0"
