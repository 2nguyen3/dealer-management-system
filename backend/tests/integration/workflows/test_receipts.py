from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.catalogues.helpers import draft, install_builders, post_stock

pytestmark = pytest.mark.integration


def test_manual_receipt_allocates_fifo_without_overpay_or_future_invoice(
    client, engine, trading, actor
):
    with Session(engine) as session:
        install_builders(session, actor)
        first = draft(
            session,
            int(trading["product"]),
            kind="STOCK_ISSUE",
            agency_id=int(trading["agency"]),
            quantity="2",
        )
        post_stock(session, first)
        session.commit()
    body = {
        "agencyId": trading["agency"],
        "businessDate": "2026-01-02",
        "amount": "150",
        "paymentMethod": "CASH",
    }
    created = client.post(
        "/api/v1/payment-receipts", json=body, headers={"Idempotency-Key": str(uuid4())}
    )
    assert created.status_code == 201, created.text
    path = "/api/v1/payment-receipts/" + created.json()["id"]
    assert created.json()["agencyBalance"]["currentDebt"] == "204"
    posted = client.post(
        path + "/post",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert posted.status_code == 200, posted.text
    assert posted.json()["agencyBalance"]["currentDebt"] == "54"
    detail = client.get(path).json()
    assert detail["appliedAmount"] == "150" and detail["creditCreatedAmount"] == "0"
    with engine.connect() as c:
        assert (
            c.scalar(text("SELECT sum(amount) FROM dms.receivable_entry WHERE kind='PAYMENT'"))
            == -150
        )
    other = client.post(
        "/api/v1/payment-receipts", json=body, headers={"Idempotency-Key": str(uuid4())}
    )
    rejected = client.post(
        "/api/v1/payment-receipts/" + other.json()["id"] + "/post",
        headers={"If-Match": other.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert rejected.status_code == 409, rejected.text
    assert client.get(path).json()["currentRevision"]["totalAmount"] == "150"
