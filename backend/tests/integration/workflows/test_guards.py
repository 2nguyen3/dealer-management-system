from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.payment_receipts.schemas import PaymentReceiptCreate, PaymentReceiptUpdate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.stock_issues.schemas import StockIssueCreate, StockIssueUpdate
from app.modules.stock_issues.service import StockIssueService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.workflows.helpers import (
    issue,
    post_issue,
    post_receipt,
    receipt,
    state,
    verify,
)
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_issue_guards_and_failure_rollback_preserve_document_history(
    client, engine, trading, actor
):
    base = {
        "agencyId": trading["agency"],
        "businessDate": "2026-01-02",
        "lines": [{"productId": trading["product"], "quantity": "1"}],
    }
    for change, status in [
        ({"agencyId": "99999"}, 404),
        ({"businessDate": "2025-12-31"}, 409),
        ({"immediatePayment": "103"}, 409),
        ({"lines": base["lines"] * 2}, 409),
        ({"lines": [{"productId": trading["product"], "quantity": "0.5"}]}, 409),
        ({"lines": [{"productId": "99999", "quantity": "1"}]}, 404),
    ]:
        before = state(engine)
        response = client.post(
            "/api/v1/stock-issues",
            json={**base, **change},
            headers={"Idempotency-Key": str(uuid4())},
        )
        assert response.status_code == status, response.text
        assert state(engine) == before
    empty = client.post(
        "/api/v1/stock-issues",
        json={"agencyId": trading["agency"], "businessDate": "2026-01-02"},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert empty.status_code == 201, empty.text
    assert (
        client.post(
            empty.headers["Location"] + "/submit",
            headers={"If-Match": empty.headers["ETag"], "Idempotency-Key": str(uuid4())},
        ).status_code
        == 409
    )
    created = issue(client, trading, submit=False)
    path = created.headers["Location"]
    assert client.patch(path, json={"note": "change"}).status_code == 428
    assert (
        client.patch(path, json={"note": "change"}, headers={"If-Match": '"stale"'}).status_code
        == 412
    )
    changed = client.patch(
        path,
        json={"note": "updated", "immediatePayment": "100"},
        headers={"If-Match": created.headers["ETag"]},
    )
    assert changed.status_code == 200, changed.text
    assert_schema(changed.json(), "StockIssue")
    assert (
        client.patch(
            path, json={"immediatePayment": "999"}, headers={"If-Match": changed.headers["ETag"]}
        ).status_code
        == 409
    )
    with Session(engine) as session:
        service = StockIssueService(
            session, CursorCodec(b"x" * 32), actor, "rollback-test", lambda _: None
        )
        before = state(engine)
        with (
            patch.object(session, "commit", side_effect=RuntimeError("injected commit failure")),
            pytest.raises(RuntimeError),
        ):
            service.create(StockIssueCreate.model_validate(base), uuid4())
        assert state(engine) == before
        current = service.get(int(created.json()["id"]))
        with (
            patch.object(
                session, "commit", side_effect=DBAPIError(None, None, Exception("failed"))
            ),
            pytest.raises(ApiError),
        ):
            service.update(
                int(current.id),
                StockIssueUpdate(note="rollback"),
                Preconditions(service.etag(current)),
            )
        assert state(engine) == before
        cancelled = service.cancel_draft(
            int(current.id),
            Reason(reason="Never dispatched"),
            Preconditions(service.etag(current)),
            uuid4(),
        )
        assert cancelled.body["status"] == "CANCELLED"
        assert len(service.get(int(current.id)).currentRevision.lines) == 1


def test_separation_creates_full_cash_credit_and_replacement_preserves_ready_history(
    client, engine, trading
):
    ready = issue(client, trading, immediate="200")
    confirmation = verify(client, ready)
    path = "/api/v1/stock-issues/" + ready.json()["id"]
    replacement = {
        "businessDate": "2026-01-03",
        "reason": "Change order",
        "immediatePayment": "0",
        "lines": [{"productId": trading["product"], "quantity": "2"}],
    }
    original = client.get(path)
    assert (
        client.post(
            path + "/revisions",
            json=replacement,
            headers={"If-Match": original.headers["ETag"], "Idempotency-Key": str(uuid4())},
        ).status_code
        == 409
    )
    headers = {"If-Match": confirmation.headers["ETag"], "Idempotency-Key": str(uuid4())}
    separate = client.post(
        confirmation.headers["Location"] + "/receive-separately",
        json={"reason": "Cannot dispatch"},
        headers=headers,
    )
    assert separate.status_code == 200, separate.text
    assert_schema(separate.json(), "UpfrontSeparatedResponse")
    assert separate.json()["agencyBalance"]["currentCredit"] == "200"
    assert separate.json()["receipt"]["currentRevision"]["businessDate"] == "2026-01-02"
    assert separate.json()["receipt"]["creditCreatedAmount"] == "200"
    assert (
        client.post(
            confirmation.headers["Location"] + "/receive-separately",
            json={"reason": "Cannot dispatch"},
            headers=headers,
        ).json()
        == separate.json()
    )
    assert post_issue(client, ready).status_code == 409
    revised = client.post(
        path + "/revisions",
        json=replacement,
        headers={"If-Match": client.get(path).headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert revised.status_code == 201, revised.text
    assert revised.json()["revisionNo"] == 2 and revised.json()["status"] == "DRAFT"
    with engine.connect() as c:
        old = c.execute(
            text('SELECT state,"immediatePayment" FROM dms.document_revision WHERE id=:id'),
            {"id": int(ready.json()["revisionId"])},
        ).one()
        assert tuple(old) == ("READY", 200)
    next_ready = client.post(
        path + "/submit",
        headers={"If-Match": revised.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )
    assert next_ready.status_code == 200, next_ready.text
    assert post_issue(client, next_ready).status_code == 200
    receipt_path = "/api/v1/payment-receipts/" + separate.json()["receipt"]["id"]
    assert (
        client.patch(
            receipt_path,
            json={"amount": "1"},
            headers={"If-Match": client.get(receipt_path).headers["ETag"]},
        ).status_code
        == 409
    )


def test_manual_receipt_header_special_receipts_and_commit_rollback(client, engine, trading, actor):
    issued = post_issue(client, issue(client, trading))
    assert issued.status_code == 200, issued.text
    created = receipt(client, trading, amount="100", method="BANK_TRANSFER")
    path = created.headers["Location"]
    changed = client.patch(
        path,
        json={"amount": "200", "note": "Counted cash", "paymentMethod": "CASH"},
        headers={"If-Match": created.headers["ETag"]},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["currentRevision"]["totalAmount"] == "200"
    before = state(engine)
    with Session(engine) as session:
        service = PaymentReceiptService(
            session, CursorCodec(b"x" * 32), actor, "receipt-rollback", lambda _: None
        )
        with (
            patch.object(session, "commit", side_effect=RuntimeError("failure")),
            pytest.raises(RuntimeError),
        ):
            service.post(int(created.json()["id"]), Preconditions(changed.headers["ETag"]), uuid4())
        assert state(engine) == before
        with (
            patch.object(session, "commit", side_effect=RuntimeError("failure")),
            pytest.raises(RuntimeError),
        ):
            service.create(
                PaymentReceiptCreate(
                    agencyId=trading["agency"],
                    businessDate="2026-01-03",
                    amount="1",
                    paymentMethod="CASH",
                ),
                uuid4(),
            )
        assert state(engine) == before
        with (
            patch.object(session, "commit", side_effect=RuntimeError("failure")),
            pytest.raises(RuntimeError),
        ):
            service.update(
                int(created.json()["id"]),
                PaymentReceiptUpdate(note="bad"),
                Preconditions(changed.headers["ETag"]),
            )
        assert state(engine) == before
        cancelled = service.cancel_draft(
            int(created.json()["id"]),
            Reason(reason="Input mistake"),
            Preconditions(changed.headers["ETag"]),
            uuid4(),
        )
        assert cancelled.body["status"] == "CANCELLED"
    future = receipt(client, trading, amount="1", day="2026-01-01")
    assert post_receipt(client, future).status_code == 409
    agency_path = "/api/v1/agencies/" + trading["agency"]
    terminated_agency = client.post(
        agency_path + "/terminate",
        json={"reason": "Stop trading"},
        headers={
            "If-Match": client.get(agency_path).headers["ETag"],
            "Idempotency-Key": str(uuid4()),
        },
    )
    assert terminated_agency.status_code == 200, terminated_agency.text
    terminated = receipt(client, trading, amount="306")
    paid = post_receipt(client, terminated)
    assert paid.status_code == 200, paid.text
    assert paid.json()["agencyBalance"]["currentDebt"] == "0"
