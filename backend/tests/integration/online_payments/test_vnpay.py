from unittest.mock import Mock, patch
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.online_payments.router import router
from app.modules.online_payments.schemas import OnlinePaymentCreate
from app.modules.online_payments.service import OnlinePaymentService
from app.modules.online_payments.vnpay import VnpayAdapter
from app.modules.payment_receipts.schemas import PaymentReceiptCreate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.refunds.online import OnlineRefundService
from app.modules.refunds.schemas import RefundCreate
from app.modules.settlement_core.service import SettlementService
from tests.integration.settlement_core.helpers import commit, issue
from tests.online_payments.test_vnpay import config, proof, signed

pytestmark = pytest.mark.integration


def native_use(session, actor, adapter=None):
    settings = config()
    return OnlinePaymentService(
        session,
        CursorCodec(b"x" * 32),
        actor,
        "native-test",
        lambda _: None,
        settings,
        adapter or VnpayAdapter(settings),
    )


def test_native_http_late_success_no_transaction_poison_return_readonly_and_rollback(
    client,
    engine,
    actor,
    trading,
):
    for name in ("vnpay_tmn_code", "vnpay_hash_secret", "vnpay_ipn_url", "vnpay_return_url"):
        setattr(client.app.state.settings, name, getattr(config(), name))
    client.app.include_router(router, prefix="/api/v1")
    with Session(engine) as session:
        issue(session, actor, (int(trading["agency"]), int(trading["product"])), day=4)
        commit(session)
    created = client.post(
        "/api/v1/online-payments",
        json={"agencyId": trading["agency"], "provider": "VNPAY", "amount": "102"},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert "sandbox.vnpayment.vn/paymentv2/" in body["checkoutUrl"]
    assert body["merchantReference"].isalnum()
    with engine.connect() as check:
        commands_before = check.scalar(text("SELECT count(*) FROM dms.api_idempotency"))
    invalid = client.post(
        "/api/v1/online-payments",
        json={"agencyId": trading["agency"], "provider": "VNPAY", "amount": "10000000000"},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert invalid.status_code == 422
    with engine.connect() as check:
        assert check.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == commands_before
        assert check.scalar(text("SELECT count(*) FROM dms.online_payment")) == 1
    data = proof(
        vnp_TxnRef=body["merchantReference"], vnp_Amount="10200", vnp_PayDate="20260106000000"
    )
    failed = signed(
        {**data, "vnp_TransactionStatus": "02", "vnp_ResponseCode": "24", "vnp_TransactionNo": "0"},
        callback=True,
    )
    assert client.get("/api/v1/integrations/vnpay/ipn", params=failed).json()["RspCode"] == "00"
    with engine.connect() as check:
        assert check.scalar(text('SELECT "providerTransactionId" FROM dms.online_payment')) is None
        assert check.scalar(text("SELECT status FROM dms.online_payment")) == "FAILED"
    returned = client.get("/api/v1/integrations/vnpay/return", params=signed(data, callback=True))
    assert returned.status_code == 200
    assert client.get(created.headers["Location"]).json()["status"] == "FAILED"
    wrong = signed({**data, "vnp_Amount": "10300"}, callback=True)
    assert client.get("/api/v1/integrations/vnpay/ipn", params=wrong).json()["RspCode"] == "04"
    with patch.object(
        SettlementService, "post_receipt", side_effect=RuntimeError("rollback-probe")
    ):
        with pytest.raises(RuntimeError, match="rollback-probe"):
            # Use the shared completion directly to inspect definite rollback.
            with Session(engine) as session:
                native_use(session, actor).complete(
                    "VNPAY", VnpayAdapter(config()).payment_evidence(data)
                )
    with engine.connect() as check:
        assert check.scalar(text("SELECT status FROM dms.online_payment")) == "FAILED"
        assert (
            check.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'"))
            == 0
        )
    success = signed(data, callback=True)
    assert client.get("/api/v1/integrations/vnpay/ipn", params=success).json()["RspCode"] == "00"
    assert client.get("/api/v1/integrations/vnpay/ipn", params=success).json()["RspCode"] == "02"
    # A late failure never erases an already successful transaction identity.
    assert client.get("/api/v1/integrations/vnpay/ipn", params=failed).json()["RspCode"] == "02"
    with engine.connect() as check:
        assert (
            check.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'"))
            == 1
        )
        assert check.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 0
        assert (
            check.scalar(text('SELECT "providerTransactionId" FROM dms.online_payment')) == "123456"
        )
    absent = signed({**data, "vnp_TxnRef": "VNPmissing"}, callback=True)
    assert client.get("/api/v1/integrations/vnpay/ipn", params=absent).json()["RspCode"] == "01"


def test_native_query_and_refund_pending_unknown_conserve_source_money(engine, actor, trading):
    with Session(engine) as session:
        issue(session, actor, (int(trading["agency"]), int(trading["product"])), day=4)
        commit(session)
        settings = config()
        client = Mock()
        adapter = VnpayAdapter(settings, client=client)
        payment = native_use(session, actor, adapter)
        created = payment.create(
            OnlinePaymentCreate(agencyId=trading["agency"], provider="VNPAY", amount="102"), uuid4()
        )
        reference = created.body["merchantReference"]
        cash = PaymentReceiptService(session, payment.codec, actor, "cash", lambda _: None)
        draft = cash.create(
            PaymentReceiptCreate(
                agencyId=trading["agency"],
                businessDate="2026-01-05",
                amount="102",
                paymentMethod="CASH",
            ),
            uuid4(),
        )
        cash.post(int(draft.body["id"]), Preconditions(draft.headers["ETag"]), uuid4())
        data = proof(vnp_TxnRef=reference, vnp_Amount="10200", vnp_PayDate="20260106000000")

        def query_reply(url, *, json, timeout):
            with engine.begin() as check:
                check.execute(
                    text('SELECT "agencyId" FROM dms.agency_balance FOR UPDATE NOWAIT')
                ).all()
            return httpx.Response(200, json=signed(data))

        client.post.side_effect = query_reply
        received = payment.reconcile(int(created.body["id"]), uuid4())
        assert received.status == "SUCCESS"
        assert session.scalar(text('SELECT "currentCredit" FROM dms.agency_balance')) == 102
        session.rollback()
        refunds = OnlineRefundService(
            session,
            payment.codec,
            actor,
            "native-refund",
            lambda _: None,
            adapter,
            provider="VNPAY",
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
        record = {}

        def pending_reply(url, *, json, timeout):
            record.update(json)
            return httpx.Response(
                200,
                json=signed(
                    proof(
                        vnp_Command="refund",
                        vnp_TxnRef=reference,
                        vnp_TransactionType="03",
                        vnp_TransactionNo="456789",
                        vnp_Amount="6000",
                        vnp_OrderInfo=json["vnp_OrderInfo"],
                        vnp_TransactionStatus="05",
                    )
                ),
            )

        client.post.side_effect = pending_reply
        pending = refunds.request(identifier, Preconditions(ready.headers["ETag"]), uuid4())
        assert pending.state == "PENDING" and record["vnp_CreateBy"] == str(actor)
        client.post.side_effect = httpx.ReadTimeout("lost query")
        with pytest.raises(Exception, match="PROVIDER_UNAVAILABLE"):
            refunds.reconcile(int(pending.id), uuid4())
        assert (
            session.scalar(
                text("SELECT sum(amount) FROM dms.refund_reservation WHERE state='ACTIVE'")
            )
            == 60
        )
        session.rollback()
        client.post.side_effect = None
        # A valid original-payment query cannot be mistaken for this refund.
        client.post.return_value = httpx.Response(200, json=signed(data))
        assert refunds.reconcile(int(pending.id), uuid4()).state == "UNKNOWN"
        result = proof(
            vnp_TxnRef=reference,
            vnp_TransactionType="03",
            vnp_TransactionNo="456789",
            vnp_Amount="6000",
            vnp_OrderInfo=record["vnp_OrderInfo"],
            vnp_PayDate="20260108000000",
        )
        client.post.return_value = httpx.Response(200, json=signed(result))
        paid = refunds.reconcile(int(pending.id), uuid4())
        assert paid.state == "SUCCESS"
        assert refunds.reconcile(int(pending.id), uuid4()).state == "SUCCESS"
        assert session.scalar(text('SELECT "currentCredit" FROM dms.agency_balance')) == 42
        assert (
            session.scalar(
                text("SELECT sum(amount) FROM dms.refund_reservation WHERE state='ACTIVE'")
            )
            is None
        )
        session.rollback()
        declined = refunds.create(
            RefundCreate(
                originDocumentId=received.receiptDocumentId,
                businessDate="2026-01-09",
                amount="30",
                paymentMethod="ONLINE",
            ),
            uuid4(),
        )
        declined_id = int(declined.body["id"])
        ready = refunds.submit(declined_id, Preconditions(declined.headers["ETag"]), uuid4())

        def declined_reply(url, *, json, timeout):
            return httpx.Response(
                200,
                json=signed(
                    proof(
                        vnp_Command="refund",
                        vnp_TxnRef=reference,
                        vnp_Amount="3000",
                        vnp_TransactionType="03",
                        vnp_TransactionNo="456790",
                        vnp_OrderInfo=json["vnp_OrderInfo"],
                        vnp_TransactionStatus="09",
                        vnp_PayDate="",
                    )
                ),
            )

        client.post.side_effect = declined_reply
        failed = refunds.request(declined_id, Preconditions(ready.headers["ETag"]), uuid4())
        assert failed.state == "FAILED" and failed.completedAt is not None
        assert session.scalar(text('SELECT "currentCredit" FROM dms.agency_balance')) == 42
        assert (
            session.scalar(text("SELECT count(*) FROM dms.refund_reservation WHERE state='ACTIVE'"))
            == 0
        )
