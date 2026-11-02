from uuid import uuid4

import pytest
from sqlalchemy import text

from tests.integration.sales_returns.test_returns import create, issue, post
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_return_credit_lots_and_statement_preserve_receipt_provenance(client, engine, trading):
    source = issue(client, trading, "4")
    receipt = client.post(
        "/api/v1/payment-receipts",
        json={
            "agencyId": trading["agency"],
            "businessDate": "2026-01-03",
            "amount": "408",
            "paymentMethod": "CASH",
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert receipt.status_code == 201, receipt.text
    paid = client.post(
        receipt.headers["Location"] + "/post",
        headers={"If-Match": receipt.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert paid.status_code == 200, paid.text
    returned = create(client, source, "2")
    posted = post(client, returned)
    assert posted.status_code == 200, posted.text
    path = f"/api/v1/agencies/{trading['agency']}"
    lots = client.get(path + "/credit-lots", params={"availableOnly": True})
    assert lots.status_code == 200, lots.text
    assert_schema(lots.json(), "CreditLotListResponse")
    lot = lots.json()["items"][0]
    assert lot["balance"] == "204" and lot["available"] == "204" and lot["reserved"] == "0"
    assert lot["originReceiptId"] == receipt.json()["id"]
    assert lot["sourceDocumentId"] == returned.json()["id"]
    detail = client.get("/api/v1/credit-lots/" + lot["id"])
    assert detail.status_code == 200 and detail.json() == lot, detail.text
    statement = client.get(
        path + "/credit-entries",
        params={"fromDate": "2026-01-04", "toDate": "2026-01-05", "lotId": lot["id"]},
    )
    assert statement.status_code == 200, statement.text
    assert_schema(statement.json(), "CreditStatement")
    assert statement.json()["openingCredit"] == "0" and statement.json()["closingCredit"] == "204"
    assert statement.json()["items"][0]["amountDelta"] == "204"
    assert client.get(path + "/balance").json()["currentDebt"] == "0"
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT "currentCredit" FROM dms.agency_balance')) == 204
