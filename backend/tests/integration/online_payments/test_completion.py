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
from tests.integration.online_payments.test_recovery import use
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("terminal", ["FAILED", "EXPIRED"])
def test_verified_late_full_success_after_intervening_cash(engine, actor, trading, terminal):
    agency, product = int(trading["agency"]), int(trading["product"])
    adapter = Mock()
    adapter.create_checkout.return_value = Checkout(
        checkoutUrl="https://controlled.test/checkout", expiresAt="2026-12-01T00:00:00Z"
    )
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=4)
        commit(session)
        online = use(session, actor, adapter)
        created = online.create(
            OnlinePaymentCreate(agencyId=str(agency), provider="CONTROLLED", amount="102"), uuid4()
        )
        reference = created.body["merchantReference"]
        evidence = dict(merchantReference=reference, providerTransactionId="txn-1", amount="102")
        stopped, _ = online.complete(
            "CONTROLLED", VerifiedPayment(**evidence, eventKey="stopped", status=terminal)
        )
        assert stopped.status == terminal
        receipts = PaymentReceiptService(session, online.codec, actor, "cash-test", lambda _: None)
        cash = receipts.create(
            PaymentReceiptCreate(
                agencyId=str(agency), businessDate="2026-01-05", amount="100", paymentMethod="CASH"
            ),
            uuid4(),
        )
        receipts.post(int(cash.body["id"]), Preconditions(cash.headers["ETag"]), uuid4())
        success = VerifiedPayment(
            **evidence, eventKey="late", status="SUCCESS", paymentTime="2026-01-06T00:00:00Z"
        )
        completed, duplicate = online.complete("CONTROLLED", success)
        assert completed.status == "SUCCESS" and not duplicate
        assert online.complete("CONTROLLED", success)[1]
        old, _ = online.complete(
            "CONTROLLED", VerifiedPayment(**evidence, eventKey="later-fail", status="FAILED")
        )
        assert old.status == "SUCCESS"
        with pytest.raises(ApiError, match="PAYMENT_CONFLICT"):
            online.complete("CONTROLLED", success.model_copy(update={"amount": success.amount - 1}))
        with pytest.raises(ApiError, match="PAYMENT_CONFLICT"):
            online.complete(
                "CONTROLLED",
                success.model_copy(update={"paymentTime": success.paymentTime.replace(hour=1)}),
            )
        with pytest.raises(ApiError, match="PAYMENT_CONFLICT"):
            online.complete(
                "CONTROLLED",
                success.model_copy(
                    update={
                        "eventKey": "conflicting-new-key",
                        "paymentTime": success.paymentTime.replace(hour=2),
                    }
                ),
            )
    with engine.connect() as check:
        assert (
            check.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'"))
            == 2
        )
        assert check.scalar(text('SELECT "currentCredit" FROM dms.agency_balance')) == 100
        assert check.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 0
