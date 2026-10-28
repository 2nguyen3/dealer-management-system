from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError, AuthError
from app.modules.document_history.schemas import ReturnLine
from app.modules.document_history.service import DocumentHistoryService
from tests.integration.sales_returns.test_returns import issue

pytestmark = pytest.mark.integration


def test_current_and_historical_reads_line_pagination_and_service_boundaries(
    history_client, engine, actor, trading
):
    client = history_client
    second = client.post(
        "/api/v1/products", json={"name": "Second product", "unitId": trading["unit"]}
    )
    assert second.status_code == 201
    receipt = client.post(
        "/api/v1/stock-receipts",
        json={
            "businessDate": "2026-01-04",
            "lines": [
                {"productId": trading["product"], "quantity": "1", "unitPrice": "50"},
                {"productId": second.json()["id"], "quantity": "1", "unitPrice": "50"},
            ],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert receipt.status_code == 201, receipt.text
    identifier = int(receipt.json()["id"])
    base = f"/api/v1/documents/{identifier}/revisions"
    assert client.get(base).status_code == 200
    assert client.get(base + "/1").status_code == 200
    for sort in ("lineNo", "-lineNo"):
        page = client.get(base + "/1/lines", params={"limit": 1, "sort": sort})
        assert page.status_code == 200, page.text
        cursor = page.json()["pagination"]["nextCursor"]
        after = client.get(base + "/1/lines", params={"limit": 1, "sort": sort, "cursor": cursor})
        assert after.json()["items"][0]["id"] != page.json()["items"][0]["id"]
    with Session(engine) as session:
        use = DocumentHistoryService(
            session, CursorCodec(b"x" * 32), actor, "history-boundary", lambda _: None
        )
        for action in (
            lambda: use.search(fromDate="2026-01-02", toDate="2026-01-01"),
            lambda: use.lines(identifier, 1, sort="invalid"),
            lambda: use.revisions(identifier, sort="invalid"),
        ):
            with pytest.raises(ApiError, match="VALIDATION_FAILED"):
                action()
        assert use.revisions(identifier, state="DRAFT").items
        session.rollback()
        use.core.authorize = lambda _: (_ for _ in ()).throw(
            AuthError(401, "INVALID_TOKEN", "Expired")
        )
        with pytest.raises(AuthError, match="INVALID_TOKEN"):
            use.search()
    # Kind mismatch and invalid parent ownership never mutate another document.
    wrong = client.post(
        base + "/1/lines",
        json={"kind": "STOCK_ADJUSTMENT", "productId": trading["product"], "quantity": "1"},
        headers={"If-Match": receipt.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert wrong.status_code == 409
    assert client.get(base + "/1/lines/999999").status_code == 404
    source = issue(client, trading, "2")
    returned = client.post(
        "/api/v1/sales-returns",
        json={"originDocumentId": source.json()["id"], "businessDate": "2026-01-06"},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert returned.status_code == 201, returned.text
    with Session(engine) as session:
        use = DocumentHistoryService(
            session, CursorCodec(b"x" * 32), actor, "return-boundary", lambda _: None
        )
        body = ReturnLine(
            kind="SALES_RETURN",
            originLineId=source.json()["currentRevision"]["lines"][0]["id"],
            quantity="1",
        )
        condition = Preconditions(returned.headers["ETag"])
        with pytest.raises(ApiError, match="NOT_FOUND"):
            use.create_line(int(returned.json()["id"]), 2, body, condition, uuid4())
        with pytest.raises(ApiError, match="NOT_FOUND"):
            use.change_line(int(returned.json()["id"]), 1, condition, body, 999999)


def test_confirmed_count_linked_lines_stay_immutable(history_client, engine, actor, trading):
    client = history_client
    count = client.post(
        "/api/v1/stock-counts",
        json={
            "countedAt": "2026-01-05T00:00:00Z",
            "reason": "Physical count",
            "lines": [{"productId": trading["product"], "countedQuantity": "99"}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert count.status_code == 201, count.text
    confirmed = client.post(
        f"/api/v1/stock-counts/{count.json()['id']}/confirm",
        headers={"If-Match": count.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert confirmed.status_code == 200, confirmed.text
    identifier = int(confirmed.json()["adjustmentDocumentId"])
    detail = client.get(f"/api/v1/stock-adjustments/{identifier}")
    line = detail.json()["currentRevision"]["lines"][0]
    deleted = client.delete(
        f"/api/v1/documents/{identifier}/revisions/1/lines/{line['id']}",
        headers={"If-Match": detail.headers["ETag"]},
    )
    assert deleted.status_code == 409, deleted.text
    with engine.connect() as check:
        assert (
            check.scalar(
                text("SELECT count(*) FROM dms.document_line WHERE id=:id"), {"id": int(line["id"])}
            )
            == 1
        )
