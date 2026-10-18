from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.stock_issues.service import StockIssueService

pytestmark = pytest.mark.integration


def test_issue_draft_submit_and_zero_money_post_freeze_prices_and_record_once(
    client, engine, trading, actor
):
    body = {
        "agencyId": trading["agency"],
        "businessDate": "2026-01-02",
        "lines": [{"productId": trading["product"], "quantity": "3"}],
    }
    key = {"Idempotency-Key": str(uuid4())}
    created = client.post("/api/v1/stock-issues", json=body, headers=key)
    assert created.status_code == 201, created.text
    identifier = created.json()["id"]
    path = "/api/v1/stock-issues/" + identifier
    assert created.json()["totalAmount"] == "306"
    assert client.post("/api/v1/stock-issues", json=body, headers=key).json() == created.json()
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 0
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 100
    ready = client.post(
        path + "/submit",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert ready.status_code == 200, ready.text
    assert ready.json()["status"] == "PENDING"
    detail = client.get(path)
    assert detail.json()["currentRevision"]["state"] == "READY"
    with engine.begin() as connection:
        connection.execute(text('UPDATE dms.business_rule SET "sellingPriceRate"=2'))
    with Session(engine) as session:
        service = StockIssueService(
            session, CursorCodec(b"x" * 32), actor, "issue-test", lambda _: None
        )
        condition = Preconditions(detail.headers["ETag"])
        key = uuid4()
        posted = service.post(int(identifier), condition, key)
        assert posted.body["agencyBalance"]["currentDebt"] == "306"
        assert posted.body["inventoryChanges"][0]["currentStock"] == "97"
        assert service.post(int(identifier), condition, key).body == posted.body
    assert client.get(path).json()["currentRevision"]["lines"][0]["unitPrice"] == "102"
    assert client.get("/api/v1/stock-issues").json()["items"][0]["outstandingAmount"] == "306"
