from unittest.mock import Mock
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.online_payments.schemas import Checkout, OnlinePaymentCreate, VerifiedPayment
from app.modules.payment_receipts.schemas import PaymentReceiptCreate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.refunds.online import OnlineRefundService
from app.modules.refunds.reads import RefundEvidenceReads
from app.modules.refunds.schemas import RefundCreate, VerifiedRefund
from tests.integration.catalogues.helpers import install_builders
from tests.integration.credit_applications.test_service import (
    create as application,
)
from tests.integration.credit_applications.test_service import (
    service as application_service,
)
from tests.integration.online_payments.test_recovery import use
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_failed_retry_creates_fresh_revision_only_after_same_source_credit_is_available(
    engine, actor, trading
):
    agency, product = int(trading["agency"]), int(trading["product"])
    adapter = Mock()
    adapter.create_checkout.return_value = Checkout(
        checkoutUrl="https://controlled.test/a", expiresAt="2026-12-01T00:00:00Z"
    )
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=4)
        commit(session)
        payment = use(session, actor, adapter)
        created = payment.create(
            OnlinePaymentCreate(agencyId=str(agency), provider="CONTROLLED", amount="102"), uuid4()
        )
        receipts = PaymentReceiptService(session, payment.codec, actor, "cash", lambda _: None)
        cash = receipts.create(
            PaymentReceiptCreate(
                agencyId=str(agency), businessDate="2026-01-05", amount="102", paymentMethod="CASH"
            ),
            uuid4(),
        )
        receipts.post(int(cash.body["id"]), Preconditions(cash.headers["ETag"]), uuid4())
        paid, _ = payment.complete(
            "CONTROLLED",
            VerifiedPayment(
                eventKey="received",
                merchantReference=created.body["merchantReference"],
                providerTransactionId="txn",
                amount="102",
                status="SUCCESS",
                paymentTime="2026-01-06T00:00:00Z",
            ),
        )
        refunds = OnlineRefundService(
            session, payment.codec, actor, "refund", lambda _: None, adapter, provider="CONTROLLED"
        )
        draft = refunds.create(
            RefundCreate(
                originDocumentId=paid.receiptDocumentId,
                businessDate="2026-01-07",
                amount="60",
                paymentMethod="ONLINE",
            ),
            uuid4(),
        )
        identifier = int(draft.body["id"])
        ready = refunds.submit(identifier, Preconditions(draft.headers["ETag"]), uuid4())
        adapter.request_refund.side_effect = lambda reference, source, amount: VerifiedRefund(
            merchantRefundReference=reference,
            providerRefundId="failed-1",
            amount="60",
            state="FAILED",
            completedAt="2026-01-07T00:00:00Z",
            failureReason="definitive failure",
        )
        failed = refunds.request(identifier, Preconditions(ready.headers["ETag"]), uuid4())
        assert failed.state == "FAILED"
        # Spend the released same-source money through the actual M25 writer.
        invoice = issue(session, actor, (agency, product), day=7)
        commit(session)
        apps = application_service(session, actor)
        value = application(apps, agency, "60", "2026-01-08")
        apps.post(int(value.body["id"]), Preconditions(value.headers["ETag"]), uuid4())
        detail = refunds.get(identifier)
        token = refunds.etag(detail)
        session.rollback()
        with pytest.raises(ApiError, match="INSUFFICIENT_CREDIT"):
            refunds.request(identifier, Preconditions(token), uuid4())
        with engine.connect() as check:
            assert (
                check.scalar(
                    text('SELECT count(*) FROM dms.document_revision WHERE "documentId"=:id'),
                    {"id": identifier},
                )
                == 1
            )
        # Return the later invoice: restore the exact original online cash provenance.
        install_builders(session, actor)
        line = session.scalar(
            text(
                "SELECT l.id FROM dms.document_line l JOIN dms.document d "
                'ON d."currentRevisionId"=l."revisionId" WHERE d.id=:id'
            ),
            {"id": invoice},
        )
        returned = session.scalar(
            text("""
            SELECT pg_temp.stock_draft('SALES_RETURN',:agency,DATE '2026-01-09',
              jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),'quantity',1,
                'price',102,'originLine',CAST(:line AS bigint),'returnAmount',102)),
                gen_random_uuid(),:origin)
        """),
            {"agency": agency, "product": product, "line": line, "origin": invoice},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": returned})
        payment.settlement.replay(agency, uuid4(), permission="returns.post")
        commit(session)
        detail = refunds.get(identifier)
        token = refunds.etag(detail)
        session.rollback()
        adapter.request_refund.side_effect = lambda reference, source, amount: VerifiedRefund(
            merchantRefundReference=reference,
            providerRefundId="success-2",
            amount="60",
            state="SUCCESS",
            completedAt="2026-01-10T00:00:00Z",
        )
        retry = refunds.request(identifier, Preconditions(token), uuid4())
        assert (
            retry.state == "SUCCESS"
            and retry.id != failed.id
            and retry.refundRevisionId != failed.refundRevisionId
        )
        reads = RefundEvidenceReads(refunds)
        for resource in ("attempts", "reservations"):
            for sort in ("id", "-id", "createdAt", "-createdAt"):
                page = reads.page(identifier, resource=resource, limit=1, sort=sort)
                assert page.pagination.hasMore
                next_page = reads.page(
                    identifier,
                    resource=resource,
                    limit=1,
                    sort=sort,
                    cursor=page.pagination.nextCursor,
                )
                assert next_page.items[0].id != page.items[0].id
        assert (
            reads.page(identifier, resource="attempts", state="FAILED").items[0].state == "FAILED"
        )
    with engine.connect() as check:
        assert check.execute(
            text("SELECT state FROM dms.refund_attempt ORDER BY id")
        ).scalars().all() == ["FAILED", "SUCCESS"]
        assert set(check.execute(text("SELECT state FROM dms.refund_reservation")).scalars()) == {
            "RELEASED",
            "CONSUMED",
        }
