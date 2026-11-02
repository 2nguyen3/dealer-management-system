from uuid import uuid4

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.integration


def test_verified_cash_is_consumed_atomically_or_separated_with_excess_credit(
    client, engine, trading
):
    created = client.post(
        "/api/v1/stock-issues",
        json={
            "agencyId": trading["agency"],
            "businessDate": "2026-01-02",
            "immediatePayment": "200",
            "lines": [{"productId": trading["product"], "quantity": "3"}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert created.status_code == 201, created.text
    path = "/api/v1/stock-issues/" + created.json()["id"]
    ready = client.post(
        path + "/submit",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert ready.status_code == 200, ready.text
    verified = client.post(
        "/api/v1/upfront-confirmations",
        json={
            "issueRevisionId": ready.json()["revisionId"],
            "amount": "200",
            "method": "BANK_TRANSFER",
            "receivedAt": "2026-01-01T18:00:00Z",
            "evidenceReference": "TEST-001",
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert verified.status_code == 201, verified.text
    with engine.connect() as c:
        assert c.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 0
    detail = client.get(path)
    posted = client.post(
        path + "/post",
        headers={"If-Match": detail.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert posted.status_code == 200, posted.text
    assert posted.json()["agencyBalance"]["currentDebt"] == "106"
    assert posted.json()["autoReceiptId"] is not None
    confirmation = client.get("/api/v1/upfront-confirmations/" + verified.json()["id"])
    assert confirmation.json()["state"] == "CONSUMED"
    assert confirmation.json()["receiptDocumentId"] == posted.json()["autoReceiptId"]
    with engine.connect() as c:
        assert (
            c.scalar(
                text(
                    'SELECT count(DISTINCT ("businessDate","businessOrder")) '
                    "FROM dms.receivable_entry"
                )
            )
            == 1
        )
