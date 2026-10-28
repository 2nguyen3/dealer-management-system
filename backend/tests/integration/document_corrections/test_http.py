from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.credit_applications.schemas import CreditApplicationCreate
from app.modules.credit_applications.service import CreditApplicationService
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.sales_returns.schemas import SalesReturnCreate
from app.modules.sales_returns.service import SalesReturnService
from app.modules.stock_adjustments.schemas import StockAdjustmentCreate
from app.modules.stock_adjustments.service import StockAdjustmentService
from app.modules.stock_issues.service import StockIssueService
from app.modules.stock_receipts.schemas import StockReceiptCreate
from app.modules.stock_receipts.service import StockReceiptService
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.test_issues import ready_with_money
from tests.integration.settlement_core.helpers import commit, financial, issue, service
from tests.integration.settlement_core.test_reservations import credit_cash
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def grants(engine, allowed):
    with engine.begin() as connection:
        connection.execute(
            text("""UPDATE dms.group_permission SET "isAllowed"=("functionId" IN (
            SELECT id FROM dms.app_function WHERE code=ANY(:allowed))) WHERE "groupId"=1"""),
            {"allowed": allowed},
        )


def fixture_document(session, actor, trading, collection):
    """Small independent fixture per owner; no unrelated HTTP lifecycle chain."""
    args = (session, CursorCodec(b"x" * 32), actor, "m29-http-fixture", lambda _: None)
    if collection in ("stock-receipts", "stock-adjustments"):
        if collection == "stock-receipts":
            owner = StockReceiptService(*args)
            body = StockReceiptCreate(
                businessDate="2026-01-02",
                lines=[
                    {
                        "productId": str(trading[1]),
                        "quantity": "2",
                        "unitPrice": "100",
                    }
                ],
            )
        else:
            owner = StockAdjustmentService(*args)
            body = StockAdjustmentCreate(
                businessDate="2026-01-02",
                reason="Initial count",
                lines=[
                    {
                        "productId": str(trading[1]),
                        "quantity": "2",
                    }
                ],
            )
        draft = owner.create(body, uuid4())
        identifier = int(draft.body["id"])
        owner.post(identifier, Preconditions(draft.headers["ETag"]), uuid4())
        line = {"productId": str(trading[1]), "quantity": "3"}
        if collection == "stock-receipts":
            line["unitPrice"] = "100"
        correction = {"businessDate": "2026-01-02", "reason": "Wrong quantity", "lines": [line]}
    elif collection == "credit-applications":
        credit_cash(session, actor, trading, 100)
        issue(session, actor, trading, quantity=3, day=4)
        commit(session)
        owner = CreditApplicationService(*args)
        draft = owner.create(
            CreditApplicationCreate(
                agencyId=str(trading[0]), businessDate="2026-01-05", amount="50"
            ),
            uuid4(),
        )
        identifier = int(draft.body["id"])
        owner.post(identifier, Preconditions(draft.headers["ETag"]), uuid4())
        correction = {"businessDate": "2026-01-05", "reason": "Wrong offset", "amount": "40"}
    else:
        invoice = issue(session, actor, trading, quantity=3)
        commit(session)
        if collection == "stock-issues":
            owner, identifier = StockIssueService(*args), invoice
            correction = {
                "businessDate": "2026-01-02",
                "reason": "Wrong quantity",
                "lines": [{"productId": str(trading[1]), "quantity": "2"}],
            }
        elif collection == "payment-receipts":
            identifier = financial(session, actor, trading[0], 100)
            service(session, actor).post_receipt(identifier, uuid4())
            commit(session)
            owner = PaymentReceiptService(*args)
            correction = {
                "businessDate": "2026-01-03",
                "reason": "Wrong amount",
                "amount": "90",
                "paymentMethod": "BANK_TRANSFER",
            }
        else:
            owner = SalesReturnService(*args)
            origin = owner.core.repo.lines(owner.core.repo.document(invoice)["currentRevisionId"])[
                0
            ]["id"]
            draft = owner.create(
                SalesReturnCreate(
                    originDocumentId=str(invoice),
                    businessDate="2026-01-04",
                    lines=[{"originLineId": str(origin), "quantity": "1"}],
                ),
                uuid4(),
            )
            identifier = int(draft.body["id"])
            owner.post(identifier, Preconditions(draft.headers["ETag"]), uuid4())
            correction = {
                "businessDate": "2026-01-04",
                "reason": "Wrong quantity",
                "lines": [{"originLineId": str(origin), "quantity": "2"}],
            }
    item = owner.core.get(identifier, check_permission=False)
    return identifier, owner.etag(item), correction


@pytest.mark.parametrize(
    "collection",
    [
        "stock-receipts",
        "stock-adjustments",
        "stock-issues",
        "payment-receipts",
        "sales-returns",
        "credit-applications",
    ],
)
def test_each_owner_correction_and_cancel_over_real_http(
    client, engine, actor, trading, collection
):
    with Session(engine) as session:
        identifier, etag, body = fixture_document(session, actor, trading, collection)
    path = f"/api/v1/{collection}/{identifier}"
    headers = {"If-Match": etag, "Idempotency-Key": str(uuid4())}
    post_permission = {
        "stock-receipts": "stock.receipt.post",
        "stock-adjustments": "stock.adjustment.post",
        "stock-issues": "stock.issue.post",
        "payment-receipts": "cash.receipt.post",
        "sales-returns": "returns.post",
        "credit-applications": "credit.apply",
    }[collection]
    for allowed in (["documents.correct"], [post_permission], []):
        grants(engine, allowed)
        before = snapshot(engine)
        rejected = client.post(path + "/corrections", json=body, headers=headers)
        assert rejected.status_code == 403, rejected.text
        assert snapshot(engine) == before
    grants(engine, ["documents.correct", post_permission])
    before = snapshot(engine)
    for content, content_type, status in (
        ("{}", "text/plain", 415),
        ("{", "application/json", 400),
    ):
        rejected = client.post(
            path + "/corrections",
            content=content,
            headers={**headers, "Content-Type": content_type},
        )
        assert rejected.status_code == status, rejected.text
        assert snapshot(engine) == before
    invalid = client.post(
        path + "/corrections", json={**body, "unexpected": "value"}, headers=headers
    )
    assert invalid.status_code == 422, invalid.text
    assert snapshot(engine) == before
    for rejected_headers, status in (
        ({"Idempotency-Key": str(uuid4())}, 428),
        ({"If-Match": etag}, 422),
        ({"If-Match": '"stale"', "Idempotency-Key": str(uuid4())}, 412),
    ):
        rejected = client.post(path + "/corrections", json=body, headers=rejected_headers)
        assert rejected.status_code == status, rejected.text
        assert snapshot(engine) == before
    result = client.post(path + "/corrections", json=body, headers=headers)
    assert result.status_code == 201, result.text
    assert_schema(result.json(), "DocumentMutationResult")
    assert result.json()["status"] == "POSTED" and result.headers["Location"].endswith(
        "/revisions/2"
    )
    repeated = client.post(path + "/corrections", json=body, headers=headers)
    assert repeated.json() == result.json() and repeated.headers["ETag"] == result.headers["ETag"]
    after = snapshot(engine)
    changed_payload = client.post(
        path + "/corrections", json={**body, "reason": "Different correction"}, headers=headers
    )
    assert changed_payload.status_code == 409, changed_payload.text
    assert snapshot(engine) == after
    cancel_headers = {"If-Match": result.headers["ETag"], "Idempotency-Key": str(uuid4())}
    cancel_body = {"reason": "False original record"}
    rejected = client.post(path + "/cancel", json=cancel_body, headers=cancel_headers)
    assert rejected.status_code == 403, rejected.text
    assert snapshot(engine) == after
    grants(engine, ["documents.cancel"])
    after = snapshot(engine)
    for invalid_body in ({"reason": " "}, {**cancel_body, "unexpected": "value"}):
        rejected = client.post(path + "/cancel", json=invalid_body, headers=cancel_headers)
        assert rejected.status_code == 422, rejected.text
        assert snapshot(engine) == after
    for rejected_headers, status in (
        ({"Idempotency-Key": str(uuid4())}, 428),
        ({"If-Match": result.headers["ETag"]}, 422),
        ({"If-Match": '"stale"', "Idempotency-Key": str(uuid4())}, 412),
    ):
        rejected = client.post(path + "/cancel", json=cancel_body, headers=rejected_headers)
        assert rejected.status_code == status, rejected.text
        assert snapshot(engine) == after
    canceled = client.post(path + "/cancel", json=cancel_body, headers=cancel_headers)
    assert canceled.status_code == 200, canceled.text
    assert_schema(canceled.json(), "DocumentMutationResult")
    assert canceled.json()["status"] == "CANCELLED"
    after = snapshot(engine)
    replayed = client.post(path + "/cancel", json=cancel_body, headers=cancel_headers)
    assert replayed.status_code == 200 and replayed.json() == canceled.json()
    assert replayed.headers["ETag"] == canceled.headers["ETag"]
    assert snapshot(engine) == after
    changed = client.post(
        path + "/cancel", json={"reason": "Different reason"}, headers=cancel_headers
    )
    assert changed.status_code == 409, changed.text
    assert snapshot(engine) == after


@pytest.mark.parametrize("posted", [False, True])
def test_upfront_cancel_requires_cash_permission_on_fresh_and_completed_http_retry(
    client, engine, actor, trading, posted
):
    identifier = ready_with_money(engine, actor, trading, posted=posted)
    path = f"/api/v1/stock-issues/{identifier}/cancel"
    with Session(engine) as session:
        owner = StockIssueService(
            session, CursorCodec(b"x" * 32), actor, "m29-http-upfront", lambda _: None
        )
        etag = owner.etag(owner.core.get(identifier, check_permission=False))
    headers = {"If-Match": etag, "Idempotency-Key": str(uuid4())}
    body = {"reason": "No delivery"}
    grants(engine, ["documents.cancel"])
    before = snapshot(engine)
    denied = client.post(path, json=body, headers=headers)
    assert denied.status_code == 403, denied.text
    assert snapshot(engine) == before
    grants(engine, ["documents.cancel", "cash.receipt.post"])
    result = client.post(path, json=body, headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["separateReceiptId"] is not None
    assert result.json()["agencyBalance"]["currentCredit"] == "40"
    before = snapshot(engine)
    repeated = client.post(path, json=body, headers=headers)
    assert repeated.status_code == 200 and repeated.json() == result.json()
    assert snapshot(engine) == before
    grants(engine, ["documents.cancel"])
    before = snapshot(engine)
    denied_replay = client.post(path, json=body, headers=headers)
    assert denied_replay.status_code == 403, denied_replay.text
    assert snapshot(engine) == before
