from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.online_payments.schemas import Checkout, OnlinePaymentCreate, VerifiedPayment
from app.modules.payment_receipts.schemas import PaymentReceiptCreate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.refunds.online import OnlineRefundService
from app.modules.refunds.schemas import (
    ManualRefundConfirmation,
    RefundCreate,
    RefundUpdate,
    VerifiedRefund,
)
from app.modules.stock_receipts.schemas import Reason
from tests.integration.online_payments.test_recovery import use
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_online_unknown_retains_reservations_and_query_posts_once(engine, actor, trading, client):
    agency, product = int(trading["agency"]), int(trading["product"])
    adapter = Mock()
    adapter.create_checkout.return_value = Checkout(
        checkoutUrl="https://controlled.test/a", expiresAt="2026-12-01T00:00:00Z"
    )
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=4)
        commit(session)
        payment = use(session, actor, adapter)
        online = payment.create(
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
        received, _ = payment.complete(
            "CONTROLLED",
            VerifiedPayment(
                eventKey="received",
                merchantReference=online.body["merchantReference"],
                providerTransactionId="txn",
                amount="102",
                status="SUCCESS",
                paymentTime="2026-01-06T00:00:00Z",
            ),
        )
        refunds = OnlineRefundService(
            session, payment.codec, actor, "refund", lambda _: None, adapter
        )
        draft = refunds.create(
            RefundCreate(
                originDocumentId=received.receiptDocumentId,
                businessDate="2026-01-07",
                amount="60",
                paymentMethod="ONLINE",
            ),
            uuid4(),
        )
        identifier = int(draft.body["id"])
        ready = refunds.submit(identifier, Preconditions(draft.headers["ETag"]), uuid4())
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            refunds.confirm_paid(
                identifier,
                ManualRefundConfirmation(
                    paidAt="2026-01-08T00:00:00Z", evidenceReference="not-online-proof"
                ),
                Preconditions(ready.headers["ETag"]),
                uuid4(),
            )

        def lost(reference, payment_reference, amount):
            with engine.begin() as check:
                assert (
                    check.scalar(
                        text(
                            "SELECT count(*) FROM dms.refund_attempt "
                            "WHERE state IN ('PENDING','UNKNOWN')"
                        )
                    )
                    == 1
                )
                check.execute(
                    text('SELECT "agencyId" FROM dms.agency_balance FOR UPDATE NOWAIT')
                ).all()
            raise ApiError(503, "PROVIDER_UNAVAILABLE", "lost")

        adapter.request_refund.side_effect = lost
        key = uuid4()
        real_commit = session.commit
        tx_attempts = []

        def transient_commit():
            tx_attempts.append(True)
            if len(tx_attempts) < 3:
                raise DBAPIError(None, None, SimpleNamespace(sqlstate="40P01"))
            real_commit()

        with (
            patch.object(session, "commit", side_effect=transient_commit),
            patch.object(refunds, "dispatch", side_effect=RuntimeError("crash-before-dispatch")),
        ):
            with pytest.raises(RuntimeError, match="crash-before-dispatch"):
                refunds.request(identifier, Preconditions(ready.headers["ETag"]), key)
        assert len(tx_attempts) == 3
        adapter.request_refund.assert_not_called()
        with engine.connect() as check:
            assert (
                check.scalar(text("SELECT count(*) FROM dms.refund_attempt WHERE state='PENDING'"))
                == 1
            )
        adapter.query_refund.side_effect = ApiError(
            404, "PROVIDER_REFERENCE_NOT_FOUND", "Authoritatively absent"
        )
        pending = refunds.request(identifier, Preconditions(ready.headers["ETag"]), key)
        assert adapter.request_refund.call_count == 1
        adapter.query_refund.side_effect = None
        assert pending.state == "UNKNOWN"
        with engine.connect() as check:
            assert (
                check.scalar(
                    text("SELECT sum(amount) FROM dms.refund_reservation WHERE state='ACTIVE'")
                )
                == 60
            )
        detail = refunds.get(identifier)
        token = refunds.etag(detail)
        session.rollback()
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            refunds.request(identifier, Preconditions(token), uuid4())
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            refunds.cancel(
                identifier,
                Reason(reason="Cannot abandon unknown money"),
                Preconditions(token),
                uuid4(),
            )
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            refunds.update(identifier, RefundUpdate(amount="59"), Preconditions(token))
        wrong = OnlineRefundService(
            session,
            payment.codec,
            actor,
            "wrong-provider",
            lambda _: None,
            adapter,
            provider="OTHER",
        )
        with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
            wrong.dispatch(int(pending.id), query=True)
        disabled = OnlineRefundService(
            session, payment.codec, actor, "no-adapter", lambda _: None, None
        )
        with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
            disabled.dispatch(int(pending.id), query=True)
        unknown_key = uuid4()
        adapter.query_refund.return_value = VerifiedRefund(
            merchantRefundReference=pending.merchantRefundReference, amount="60", state="UNKNOWN"
        )
        assert refunds.reconcile(int(pending.id), unknown_key).state == "UNKNOWN"
        adapter.query_refund.side_effect = ApiError(503, "PROVIDER_UNAVAILABLE", "query timeout")
        with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
            refunds.reconcile(int(pending.id), uuid4())
        adapter.query_refund.side_effect = ApiError(
            404, "PROVIDER_REFERENCE_NOT_FOUND", "Verified absence"
        )
        with pytest.raises(ApiError, match="INVALID_PROVIDER_RESPONSE"):
            refunds.reconcile(int(pending.id), uuid4())
        adapter.query_refund.side_effect = None
        adapter.query_refund.return_value = VerifiedRefund(
            merchantRefundReference="wrong-reference", amount="60", state="UNKNOWN"
        )
        with pytest.raises(ApiError, match="INVALID_PROVIDER_RESPONSE"):
            refunds.reconcile(int(pending.id), uuid4())
        adapter.query_refund.return_value = VerifiedRefund(
            merchantRefundReference=pending.merchantRefundReference,
            providerRefundId="refund-1",
            amount="60",
            state="SUCCESS",
            completedAt="2026-01-08T00:00:00Z",
        )
        poller = session.scalar(
            text(
                'INSERT INTO dms.app_user ("fullName",email,"passwordHash","groupId") '
                "SELECT 'Poller','poller@example.com',\"passwordHash\",\"groupId\" "
                "FROM dms.app_user WHERE id=:id RETURNING id"
            ),
            {"id": actor},
        )
        session.commit()
        polling = OnlineRefundService(
            session, payment.codec, poller, "poll", lambda _: None, adapter, provider="CONTROLLED"
        )
        reconcile_key = uuid4()
        original_commit = session.commit
        commits = []

        def lost_result_reply():
            original_commit()
            commits.append(True)
            if len(commits) == 3:
                raise DBAPIError(
                    None, None, Exception("lost-final-result"), connection_invalidated=True
                )

        with patch.object(session, "commit", side_effect=lost_result_reply):
            with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
                polling.reconcile(int(pending.id), reconcile_key)
        paid = polling.reconcile(int(pending.id), reconcile_key)
        assert paid.state == "SUCCESS"
        assert polling.reconcile(int(pending.id), reconcile_key) == paid
        assert refunds.reconcile(int(pending.id), unknown_key).state == "SUCCESS"
        assert refunds.dispatch(int(pending.id), query=True).id == paid.id
        assert refunds.complete_attempt(int(pending.id), adapter.query_refund.return_value) == paid
        with pytest.raises(ApiError, match="REFUND_CONFLICT"):
            refunds.complete_attempt(
                int(pending.id),
                adapter.query_refund.return_value.model_copy(update={"state": "FAILED"}),
            )
        draft2 = refunds.create(
            RefundCreate(
                originDocumentId=received.receiptDocumentId,
                businessDate="2026-01-09",
                amount="20",
                paymentMethod="ONLINE",
            ),
            uuid4(),
        )
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            refunds.request(int(draft2.body["id"]), Preconditions(draft2.headers["ETag"]), uuid4())
        ready2 = refunds.submit(
            int(draft2.body["id"]), Preconditions(draft2.headers["ETag"]), uuid4()
        )
        with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
            wrong.request(int(draft2.body["id"]), Preconditions(ready2.headers["ETag"]), uuid4())
        disabled = OnlineRefundService(
            session, payment.codec, actor, "disabled", lambda _: None, None
        )
        with pytest.raises(ApiError, match="PROVIDER_UNAVAILABLE"):
            disabled.request(int(draft2.body["id"]), Preconditions(ready2.headers["ETag"]), uuid4())
        adapter.request_refund.side_effect = lambda reference, source, amount: VerifiedRefund(
            merchantRefundReference=reference,
            providerRefundId="wrong-amount",
            amount="21",
            state="SUCCESS",
            completedAt="2026-01-10T00:00:00Z",
        )
        uncertain = refunds.request(
            int(draft2.body["id"]), Preconditions(ready2.headers["ETag"]), uuid4()
        )
        assert uncertain.state == "UNKNOWN"
        with engine.connect() as check:
            assert (
                check.scalar(
                    text("SELECT sum(amount) FROM dms.refund_reservation WHERE state='ACTIVE'")
                )
                == 20
            )
        adapter.query_refund.return_value = VerifiedRefund(
            merchantRefundReference=uncertain.merchantRefundReference,
            providerRefundId="definitive-failure-2",
            amount="20",
            state="FAILED",
            completedAt="2026-01-10T00:00:00Z",
        )
        assert refunds.reconcile(int(uncertain.id), uuid4()).state == "FAILED"
        token2 = refunds.etag(refunds.get(int(draft2.body["id"])))
        session.rollback()
        canceled = refunds.cancel(
            int(draft2.body["id"]),
            Reason(reason="No provider"),
            Preconditions(token2),
            uuid4(),
        )
        assert canceled.body["status"] == "CANCELLED"
        session.rollback()
        from app.modules.refunds.router import router

        client.app.include_router(router, prefix="/api/v1")
        client.app.state.settings.payment_provider = "CONTROLLED"
        with patch("app.modules.refunds.dependencies.adapter_for", return_value=adapter):
            parent = f"/api/v1/refunds/{identifier}"
            replay = client.post(
                parent + "/attempts",
                headers={"If-Match": ready.headers["ETag"], "Idempotency-Key": str(key)},
            )
            assert replay.status_code == 202, replay.text
            assert replay.json()["state"] == "SUCCESS" and replay.headers["Location"].endswith(
                "/" + pending.id
            )
            attempt_path = replay.headers["Location"]
            detail = client.get(attempt_path)
            assert detail.status_code == 200 and detail.headers["ETag"]
            assert (
                client.get(parent + "/attempts", params={"state": "SUCCESS"}).json()["items"][0][
                    "id"
                ]
                == pending.id
            )
            result = client.post(
                attempt_path + "/reconcile", headers={"Idempotency-Key": str(uuid4())}
            )
            assert result.status_code == 200, result.text
            assert result.json()["state"] == "SUCCESS" and result.headers["ETag"]
    with engine.connect() as check:
        assert (
            check.scalar(text("SELECT sum(amount) FROM dms.credit_entry WHERE kind='REFUND'"))
            == -60
        )
        assert check.scalar(text("SELECT state FROM dms.refund_reservation")) == "CONSUMED"
        assert (
            check.scalar(
                text(
                    'SELECT r."postedBy" FROM dms.document_revision r '
                    "JOIN dms.document d ON d.\"currentRevisionId\"=r.id WHERE d.kind='REFUND'"
                )
            )
            == actor
        )
