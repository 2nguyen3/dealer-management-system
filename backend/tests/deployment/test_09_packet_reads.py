"""Read-only published packet checks against explicitly selected dev URLs."""

import os
from io import BytesIO

import httpx
import pytest
from pypdf import PdfReader

from app.db.seed import DEMO_USERS
from tests.support.contract import assert_schema

pytestmark = [pytest.mark.integration, pytest.mark.deployment]


@pytest.mark.parametrize(
    "variable", ["VNPAY_SMOKE_DIRECT_URL", "VNPAY_SMOKE_PROXY_URL", "VNPAY_SMOKE_PUBLIC_URL"]
)
def test_published_payment_refund_history_and_vietnamese_pdf(variable):
    base, payment_id = os.environ.get(variable), os.environ.get("VNPAY_SMOKE_PAYMENT_ID")
    if not base or not payment_id:
        pytest.fail("Explicit development URL and accepted sandbox payment ID required")
    with httpx.Client(
        base_url=base, timeout=60, headers={"ngrok-skip-browser-warning": "true"}
    ) as client:
        login = client.post(
            "/api/v1/auth/login", json={"email": DEMO_USERS[0][0], "password": DEMO_USERS[0][3]}
        )
        assert login.status_code == 200
        client.headers["Authorization"] = "Bearer " + login.json()["accessToken"]
        schema = client.get("/api/openapi.json").json()
        assert sum(len(methods) for methods in schema["paths"].values()) == 155
        payment = client.get(f"/api/v1/online-payments/{payment_id}")
        assert payment.status_code == 200
        assert_schema(payment.json(), "OnlinePayment")
        assert payment.json()["provider"] == "VNPAY" and payment.json()["status"] == "SUCCESS"
        assert payment.json()["amount"] == "10200"
        events = client.get(f"/api/v1/online-payments/{payment_id}/events")
        assert events.status_code == 200
        assert len(events.json()["items"]) == 1
        refunds = client.get("/api/v1/refunds", params={"limit": 1})
        assert refunds.status_code == 200
        for kind in (
            "STOCK_RECEIPT",
            "STOCK_ISSUE",
            "STOCK_ADJUSTMENT",
            "PAYMENT_RECEIPT",
            "SALES_RETURN",
            "CREDIT_APPLICATION",
            "REFUND",
        ):
            documents = client.get("/api/v1/documents", params={"kind": kind, "limit": 1})
            assert documents.status_code == 200 and documents.json()["items"]
            assert documents.json()["items"][0]["kind"] == kind
        receipt = payment.json()["receiptDocumentId"]
        versions = client.get(f"/api/v1/documents/{receipt}/revisions")
        assert versions.status_code == 200 and versions.json()["items"]
        html = client.get(f"/api/v1/documents/{receipt}/print")
        assert html.status_code == 200 and "text/html" in html.headers["Content-Type"]
        pdf = client.get(
            f"/api/v1/documents/{receipt}/print", headers={"Accept": "application/pdf"}
        )
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
        extracted = "\n".join(page.extract_text() for page in PdfReader(BytesIO(pdf.content)).pages)
        assert "Phiếu thu tiền" in extracted and "ĐÃ GHI SỔ" in extracted
        wrong_method = client.get("/api/v1/stock-receipts/1/corrections")
        assert wrong_method.status_code == 405 and "POST" in wrong_method.headers["Allow"]
