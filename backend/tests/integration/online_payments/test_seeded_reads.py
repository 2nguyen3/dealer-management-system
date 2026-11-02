from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import event, text
from sqlalchemy.orm import Session

from app.db.seed import main as seed_main
from app.modules.online_payments.schemas import Checkout, OnlinePaymentCreate, VerifiedPayment
from tests.integration.online_payments.test_recovery import use
from tests.integration.settlement_core.helpers import commit, issue
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_all_seeded_payment_events_are_readable_without_rewriting_simulated_evidence(
    database_factory,
):
    with database_factory() as engine:
        with patch("app.db.seed.build_engine", return_value=engine):
            seed_main()
        with Session(engine) as session:
            actor = session.scalar(text("SELECT id FROM dms.app_user ORDER BY id LIMIT 1"))
            service = use(session, actor, None)
            originals = session.execute(
                text("SELECT to_jsonb(e) FROM dms.payment_event e ORDER BY id")
            ).all()
            payments = service.list(limit=100)
            assert len(payments.items) == 20
            for payment in payments.items:
                events = service.events(int(payment.id), limit=100)
                assert_schema(events.model_dump(mode="json"), "PaymentEventListResponse")
                for item in events.items:
                    assert item.verifiedData.merchantReference == payment.merchantReference
                    assert item.verifiedData.amount == payment.amount
                    assert "demo" not in item.verifiedData.model_dump()
                    if item.providerStatus != "SUCCESS":
                        assert item.verifiedData.providerTransactionId == ""
            session.rollback()
        with engine.connect() as check:
            assert (
                check.execute(text("SELECT to_jsonb(e) FROM dms.payment_event e ORDER BY id")).all()
                == originals
            )


def test_filtered_payment_page_is_one_snapshot_when_callback_commits_during_projection(
    engine, actor, trading
):
    adapter = Mock()
    adapter.create_checkout.return_value = Checkout(
        checkoutUrl="https://controlled.test/a", expiresAt="2026-12-01T00:00:00Z"
    )
    with Session(engine) as session:
        issue(session, actor, (int(trading["agency"]), int(trading["product"])), day=4)
        commit(session)
        service = use(session, actor, adapter)
        pending = service.create(
            OnlinePaymentCreate(agencyId=trading["agency"], provider="CONTROLLED", amount="102"),
            uuid4(),
        )
        fired = []

        def after_page(connection, cursor, statement, parameters, context, executemany):
            if not fired and ".online_payment p" in statement and "ORDER BY p." in statement:
                fired.append(True)
                with Session(engine) as callback_session:
                    use(callback_session, actor, adapter).complete(
                        "CONTROLLED",
                        VerifiedPayment(
                            eventKey="snapshot-success",
                            merchantReference=pending.body["merchantReference"],
                            providerTransactionId="snapshot-txn",
                            amount="102",
                            status="SUCCESS",
                            paymentTime="2026-01-05T00:00:00Z",
                        ),
                    )

        event.listen(engine, "after_cursor_execute", after_page)
        try:
            page = service.list(status="PENDING")
        finally:
            event.remove(engine, "after_cursor_execute", after_page)
        assert (
            fired and page.items[0].status == "PENDING" and page.items[0].receiptDocumentId is None
        )
        assert service.get(int(pending.body["id"])).status == "SUCCESS"
