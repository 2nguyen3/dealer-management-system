import hashlib
import hmac
import json
import os
import time
from io import BytesIO
from uuid import uuid4

import httpx
import pytest
from pypdf import PdfReader

from app.db.seed import DEMO_USERS
from tests.support.contract import assert_schema

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize("variable", ["AUTH_SMOKE_DIRECT_URL", "AUTH_SMOKE_PROXY_URL"])
def test_controlled_provider_full_cash_refund_and_snapshot_history(variable):
    base = os.environ.get(variable)
    secret = os.environ.get("AGENTRA_CONTROLLED_WEBHOOK_KEY")
    if not base or not base.startswith("http://127.0.0.1:") or not secret:
        pytest.fail("Explicit isolated deployment and controlled fixture key required")
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

        def action(value, suffix, *, body=None, token=None):
            response = client.post(
                value.headers["Location"] + "/" + suffix,
                json=body,
                headers={
                    "If-Match": token or value.headers["ETag"],
                    "Idempotency-Key": str(uuid4()),
                },
            )
            assert response.status_code == 200, response.text
            return response

        name = "PROVIDER_" + uuid4().hex
        district = create("/api/v1/districts", {"code": name, "name": name})
        agency = create(
            "/api/v1/agencies",
            {
                "name": name,
                "typeId": 1,
                "districtId": district.json()["id"],
                "email": "smoke@example.com",
                "acceptedDate": "2026-10-01",
            },
        )
        product = create("/api/v1/products", {"name": "Sữa đậu nành " + name, "unitId": 1})
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
        issue = create(
            "/api/v1/stock-issues",
            {
                "agencyId": agency.json()["id"],
                "businessDate": "2026-10-02",
                "lines": [{"productId": product.json()["id"], "quantity": "1"}],
            },
        )
        ready = action(issue, "submit")
        posted = action(issue, "post", token=ready.headers["ETag"])
        amount = posted.json()["totalAmount"]
        payment = create(
            "/api/v1/online-payments",
            {"agencyId": agency.json()["id"], "provider": "CONTROLLED", "amount": amount},
        )
        assert payment.json()["checkoutUrl"]
        manual = create(
            "/api/v1/payment-receipts",
            {
                "agencyId": agency.json()["id"],
                "businessDate": "2026-10-03",
                "amount": "50",
                "paymentMethod": "CASH",
            },
        )
        action(manual, "post")
        payload = {
            "eventKey": "smoke-success",
            "merchantReference": payment.json()["merchantReference"],
            "providerTransactionId": "txn-" + payment.json()["merchantReference"],
            "amount": amount,
            "status": "SUCCESS",
            "paymentTime": "2026-10-06T00:00:00Z",
        }
        raw = json.dumps(payload).encode()
        timestamp = str(int(time.time()))
        signature = hmac.new(
            secret.encode(), timestamp.encode() + b"." + raw, hashlib.sha256
        ).hexdigest()
        ack = client.post(
            "/api/v1/payment-webhooks/CONTROLLED",
            content=raw,
            headers={
                "Content-Type": "application/json",
                "X-Webhook-Timestamp": timestamp,
                "X-Webhook-Key-Id": "fixture",
                "X-Webhook-Signature": signature,
            },
        )
        assert ack.status_code == 200, ack.text
        assert_schema(ack.json(), "WebhookAcknowledgement")
        detail = client.get(payment.headers["Location"])
        assert detail.status_code == 200 and detail.json()["status"] == "SUCCESS"
        assert client.get(payment.headers["Location"] + "/events").status_code == 200
        assert (
            client.get(
                "/api/v1/online-payments", params={"agencyId": agency.json()["id"]}
            ).status_code
            == 200
        )
        reconcile = client.post(
            payment.headers["Location"] + "/reconcile", headers={"Idempotency-Key": str(uuid4())}
        )
        assert reconcile.status_code == 200, reconcile.text
        refund = create(
            "/api/v1/refunds",
            {
                "originDocumentId": detail.json()["receiptDocumentId"],
                "businessDate": "2026-10-07",
                "amount": "40",
                "paymentMethod": "ONLINE",
            },
        )
        reserved = action(refund, "submit")
        attempt = client.post(
            refund.headers["Location"] + "/attempts",
            headers={"If-Match": reserved.headers["ETag"], "Idempotency-Key": str(uuid4())},
        )
        assert attempt.status_code == 202, attempt.text
        assert attempt.json()["state"] == "UNKNOWN"
        assert client.get(refund.headers["Location"] + "/reservations").status_code == 200
        assert client.get(refund.headers["Location"] + "/attempts").status_code == 200
        paid = client.post(
            attempt.headers["Location"] + "/reconcile", headers={"Idempotency-Key": str(uuid4())}
        )
        assert paid.status_code == 200, paid.text
        assert paid.json()["state"] == "SUCCESS"
        assert client.get(attempt.headers["Location"]).status_code == 200
        final = client.get(refund.headers["Location"])
        assert final.json()["status"] == "POSTED"
        history = f"/api/v1/documents/{refund.json()['id']}"
        assert (
            client.get("/api/v1/documents", params={"agencyId": agency.json()["id"]}).status_code
            == 200
        )
        assert client.get(history + "/revisions").status_code == 200
        assert client.get(history + "/revisions/1").status_code == 200
        assert client.get(history + "/revisions/1/lines").json()["items"] == []
        pdf = client.get(history + "/print", headers={"Accept": "application/pdf"})
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
        extracted = "\n".join(page.extract_text() for page in PdfReader(BytesIO(pdf.content)).pages)
        assert "Phiếu hoàn tiền" in extracted and "ĐÃ GHI SỔ" in extracted
        assert client.get(history + "/print").headers["Content-Type"].startswith("text/html")
        balance = client.get(agency.headers["Location"] + "/balance").json()
        assert (
            balance["currentDebt"] == "0"
            and balance["currentCredit"] == "10"
            and balance["reservedCredit"] == "0"
        )
