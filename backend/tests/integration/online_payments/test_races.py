from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.online_payments.schemas import Checkout, OnlinePaymentCreate, VerifiedPayment
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.online_payments.test_recovery import use
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("winner", ["webhook", "reconcile"])
def test_reconcile_and_webhook_share_completion_one_full_receipt(engine, actor, trading, winner):
    agency, product = int(trading["agency"]), int(trading["product"])
    adapter = Mock()
    adapter.create_checkout.return_value = Checkout(
        checkoutUrl="https://controlled.test/checkout", expiresAt="2026-12-01T00:00:00Z"
    )
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=4)
        commit(session)
        created = use(session, actor, adapter).create(
            OnlinePaymentCreate(agencyId=str(agency), provider="CONTROLLED", amount="102"), uuid4()
        )
    evidence = VerifiedPayment(
        eventKey="same-success",
        merchantReference=created.body["merchantReference"],
        providerTransactionId="txn-1",
        amount="102",
        status="SUCCESS",
        paymentTime="2026-01-05T00:00:00Z",
    )
    adapter.query_payment.return_value = evidence

    def webhook(session):
        return use(session, actor, adapter).complete("CONTROLLED", evidence)[0].receiptDocumentId

    def reconcile(session):
        return (
            use(session, actor, adapter)
            .reconcile(int(created.body["id"]), uuid4())
            .receiptDocumentId
        )

    def leading_reconcile(session):
        gated = session.commit
        commits = []

        def commit_money_phase():
            commits.append(True)
            if len(commits) == 1:
                Session.commit(session)  # TX1 has no money locks; gate TX2 instead.
            else:
                gated()

        with patch.object(session, "commit", side_effect=commit_money_phase):
            return reconcile(session)

    first, second = (
        ordered_race(engine, webhook, reconcile)
        if winner == "webhook"
        else ordered_race(engine, leading_reconcile, webhook)
    )
    assert first == second
    with engine.connect() as check:
        assert (
            check.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'"))
            == 1
        )
        assert check.scalar(text("SELECT count(*) FROM dms.payment_event")) == 1
