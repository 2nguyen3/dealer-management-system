from datetime import date
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError, AuthError
from app.modules.document_core.financial import agency_balance
from app.modules.payment_receipts.schemas import PaymentReceiptCreate, PaymentReceiptUpdate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.receivables.service import ReceivableService
from app.modules.stock_issues.schemas import (
    PendingIssueRevision,
    StockIssueCreate,
    StockIssueUpdate,
)
from app.modules.stock_issues.service import StockIssueService
from app.modules.stock_receipts.schemas import Reason
from app.modules.upfront_payments.schemas import UpfrontCreate
from app.modules.upfront_payments.service import UpfrontPaymentService
from tests.integration.workflows.helpers import state
from tests.integration.workflows.test_races import ready_issue, service

pytestmark = pytest.mark.integration


def test_submit_post_current_eligibility_limits_zero_totals_and_rollback(engine, actor, trading):
    with Session(engine) as s:
        issues = service(StockIssueService, s, actor)
        body = StockIssueCreate(
            agencyId=trading["agency"],
            businessDate="2026-01-02",
            lines=[{"productId": trading["product"], "quantity": "1"}],
        )
        created = issues.create(body, uuid4())
        identifier = int(created.body["id"])
        token = Preconditions(created.headers["ETag"])
        before = state(engine)
        with (
            patch.object(s, "commit", side_effect=RuntimeError("fail")),
            pytest.raises(RuntimeError),
        ):
            issues.submit(identifier, token, uuid4())
        assert state(engine) == before
        s.execute(text('UPDATE dms.agency_type SET "maxDebt"=0 WHERE id=1'))
        s.commit()
        with pytest.raises(ApiError, match="LIMIT_CONFLICT"):
            issues.submit(identifier, token, uuid4())
        s.execute(text('UPDATE dms.agency_type SET "maxDebt"=1000 WHERE id=1'))
        s.commit()
        ready = issues.submit(identifier, token, uuid4())
        token = Preconditions(ready.headers["ETag"])
        s.execute(
            text("UPDATE dms.product SET status='INACTIVE' WHERE id=:id"),
            {"id": int(trading["product"])},
        )
        s.commit()
        with pytest.raises(ApiError, match="INACTIVE_MASTER"):
            issues.post(identifier, token, uuid4())
        s.execute(
            text("UPDATE dms.product SET status='ACTIVE' WHERE id=:id"),
            {"id": int(trading["product"])},
        )
        s.commit()
        s.execute(text('UPDATE dms.agency_type SET "maxDebt"=0 WHERE id=1'))
        s.commit()
        before = state(engine)
        with pytest.raises(ApiError, match="LIMIT_CONFLICT"):
            issues.post(identifier, token, uuid4())
        assert state(engine) == before
        s.execute(text('UPDATE dms.agency_type SET "maxDebt"=1000 WHERE id=1'))
        s.commit()
        before = state(engine)
        with (
            patch.object(s, "commit", side_effect=RuntimeError("fail")),
            pytest.raises(RuntimeError),
        ):
            issues.post(identifier, token, uuid4())
        assert state(engine) == before
        replacement = PendingIssueRevision(
            businessDate="2026-01-03",
            reason="Change",
            immediatePayment="0",
            lines=[{"productId": trading["product"], "quantity": "1"}],
        )
        with (
            patch.object(s, "commit", side_effect=RuntimeError("fail")),
            pytest.raises(RuntimeError),
        ):
            issues.replace_pending(identifier, replacement, token, uuid4())
        assert state(engine) == before
        revised = issues.replace_pending(identifier, replacement, token, uuid4())
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            issues.post(identifier, Preconditions(revised.headers["ETag"]), uuid4())
        with pytest.raises(ApiError, match="NOT_FOUND"):
            issues.get(1)  # Opening stock receipt has the wrong kind.
        with pytest.raises(ApiError, match="NOT_FOUND"):
            issues.update(1, StockIssueUpdate(note="bad"), Preconditions('"x"'))
        for args in (
            {"fromDate": date(2026, 1, 2), "toDate": date(2026, 1, 2)},
            {"sort": "unknown"},
        ):
            with pytest.raises(ApiError):
                issues.list(**args)
        s.rollback()


def test_upfront_wrong_revision_amount_duplicate_and_commit_failures(engine, actor, trading):
    with Session(engine) as s:
        ready = ready_issue(s, actor, trading, immediate="200")
        upfront = service(UpfrontPaymentService, s, actor)
        base = dict(
            issueRevisionId=ready.body["revisionId"],
            amount="200",
            method="CASH",
            receivedAt="2026-01-01T18:00:00Z",
        )
        for update, code in (
            ({"amount": "199"}, "UPFRONT_CONFLICT"),
            ({"issueRevisionId": "99999"}, "NOT_FOUND"),
            ({"issueRevisionId": "1"}, "NOT_FOUND"),
            ({"receivedAt": "2025-12-30T18:00:00Z"}, "AGENCY_CONFLICT"),
        ):
            with pytest.raises(ApiError, match=code):
                upfront.verify(UpfrontCreate(**{**base, **update}), uuid4())
        before = state(engine)
        with (
            patch.object(s, "commit", side_effect=RuntimeError("fail")),
            pytest.raises(RuntimeError),
        ):
            upfront.verify(UpfrontCreate(**base), uuid4())
        assert state(engine) == before
        confirmed = upfront.verify(UpfrontCreate(**base), uuid4())
        with pytest.raises(ApiError, match="UPFRONT_CONFLICT"):
            upfront.verify(UpfrontCreate(**base), uuid4())
        before = state(engine)
        with (
            patch.object(s, "commit", side_effect=RuntimeError("fail")),
            pytest.raises(RuntimeError),
        ):
            upfront.separate(
                int(confirmed.body["id"]),
                Reason(reason="No stock"),
                Preconditions(confirmed.headers["ETag"]),
                uuid4(),
            )
        assert state(engine) == before
        with pytest.raises(ValueError):
            upfront.repo.finish(int(confirmed.body["id"]), "VERIFIED", 1)
        issue_service = service(StockIssueService, s, actor)
        current = issue_service.get(int(ready.body["id"]))
        issue_service.post(int(current.id), Preconditions(issue_service.etag(current)), uuid4())
        latest = upfront.get(int(confirmed.body["id"]))
        with pytest.raises(ApiError, match="UPFRONT_CONFLICT"):
            upfront.separate(
                int(latest.id),
                Reason(reason="Too late"),
                Preconditions(upfront.etag(latest)),
                uuid4(),
            )
        with pytest.raises(ApiError, match="UPFRONT_CONFLICT"):
            upfront.verify(UpfrontCreate(**base), uuid4())
        with pytest.raises(ApiError, match="VALIDATION_FAILED"):
            upfront.list(createdFrom=latest.createdAt, createdTo=latest.createdAt)
        s.rollback()


def test_receivable_boundaries_and_service_authorization(engine, actor, trading):
    with Session(engine) as s:
        reads = service(ReceivableService, s, actor)
        for action in (
            lambda: reads.invoice(99999),
            lambda: reads.invoice(1),
            lambda: reads.invoices(99999),
            lambda: reads.statement(99999),
            lambda: reads.allocations(99999),
            lambda: agency_balance(s, 99999),
        ):
            with pytest.raises(ApiError, match="NOT_FOUND"):
                action()
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            reads.allocations(1)
        draft = service(StockIssueService, s, actor).create(
            StockIssueCreate(agencyId=trading["agency"], businessDate="2026-01-02"), uuid4()
        )
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            reads.invoice(int(draft.body["id"]))
        for action in (
            lambda: reads.overview(sort="wrong"),
            lambda: reads.overview(debtFrom=Decimal(2), debtTo=Decimal(1)),
            lambda: reads.invoices(1, sort="wrong"),
            lambda: reads.statement(1, sort="wrong"),
            lambda: reads.statement(1, fromDate=date(2026, 2, 1), toDate=date(2026, 1, 1)),
        ):
            with pytest.raises(ApiError, match="VALIDATION_FAILED"):
                action()

        def denied(required):
            raise AuthError(403, "FORBIDDEN", "Denied")

        limited = ReceivableService(s, CursorCodec(b"x" * 32), actor, "denied", denied)
        with pytest.raises(AuthError):
            limited.balance(1)
        with pytest.raises(AuthError):
            limited.overview()
        with pytest.raises(AuthError):
            limited.invoices(1)
        with pytest.raises(AuthError):
            limited.statement(1)
        with pytest.raises(AuthError):
            limited.allocations(1)
        s.rollback()


def test_net_limit_and_backdated_receipt_replay_keep_atomic_balances(engine, actor, trading):
    with Session(engine) as s:
        s.execute(text('UPDATE dms.agency_type SET "maxDebt"=110 WHERE id=1'))
        s.commit()
        ready = ready_issue(s, actor, trading, immediate="200")
        upfront = service(UpfrontPaymentService, s, actor)
        upfront.verify(
            UpfrontCreate(
                issueRevisionId=ready.body["revisionId"],
                amount="200",
                method="CASH",
                receivedAt="2026-01-02T01:00:00Z",
            ),
            uuid4(),
        )
        issues = service(StockIssueService, s, actor)
        current = issues.get(int(ready.body["id"]))
        posted = issues.post(int(current.id), Preconditions(issues.etag(current)), uuid4())
        assert posted.body["agencyBalance"]["currentDebt"] == "106"
        reads = service(ReceivableService, s, actor)
        statement = reads.statement(int(trading["agency"]))
        assert [row.balanceAfter for row in statement.items] == [Decimal(106), Decimal(106)]
        assert reads.allocations(int(current.id)).items[0].amountDelta == Decimal(-200)
        receipts = service(PaymentReceiptService, s, actor)
        future = receipts.create(
            PaymentReceiptCreate(
                agencyId=trading["agency"],
                businessDate="2026-01-05",
                amount="50",
                paymentMethod="CASH",
            ),
            uuid4(),
        )
        receipts.post(int(future.body["id"]), Preconditions(future.headers["ETag"]), uuid4())
        earlier = receipts.create(
            PaymentReceiptCreate(
                agencyId=trading["agency"],
                businessDate="2026-01-03",
                amount="56",
                paymentMethod="CASH",
            ),
            uuid4(),
        )
        receipts.post(int(earlier.body["id"]), Preconditions(earlier.headers["ETag"]), uuid4())
        assert reads.balance(int(trading["agency"])).currentDebt == 0
        assert reads.invoice(int(current.id)).settlementStatus == "SETTLED"
        with pytest.raises(ApiError, match="RECEIPT_CONFLICT"):
            receipts.update(
                int(posted.body["autoReceiptId"]),
                PaymentReceiptUpdate(note="forbidden"),
                Preconditions(receipts.etag(receipts.get(int(posted.body["autoReceiptId"])))),
            )
        s.rollback()
