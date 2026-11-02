from datetime import date
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError, AuthError
from app.modules.document_core.repository import DocumentRepository
from app.modules.inventory.repository import InventoryRepository
from app.modules.settlement_core.models import Leg
from app.modules.settlement_core.repository import SettlementRepository
from tests.integration.settlement_core.helpers import commit, financial, issue, mark_posted, service

pytestmark = pytest.mark.integration


def test_manual_fifo_post_snapshots_historical_balance_and_no_implicit_commit(
    engine, actor, trading
):
    with Session(engine) as session:
        first = issue(session, actor, trading, quantity=1)
        second = issue(session, actor, trading, quantity=2, day=3)
        commit(session)
        receipt = financial(session, actor, trading[0], 150, day=4)
        plan = service(session, actor).post_receipt(receipt, uuid4())
        assert plan.debt == 156 and plan.credit == 0
        with engine.connect() as outside:
            assert (
                outside.execute(
                    text("SELECT id FROM dms.document WHERE id=:id"), {"id": receipt}
                ).scalar()
                is None
            )
        commit(session)
        repo = SettlementRepository(session)
        rows = repo.effective(repo.source(receipt)["revisionId"], "receivable")
        assert [(r["issueDocumentId"], r["amount"]) for r in rows] == [
            (first, Decimal(-102)),
            (second, Decimal(-48)),
        ]
        assert repo.balance(trading[0])["debt"] == 156
        assert repo.balance(trading[0], (date(2026, 1, 2), 999999))["debt"] == 102
        assert (
            session.scalar(
                text('SELECT "agencyName" FROM dms.document_revision WHERE id=:id'),
                {"id": repo.source(receipt)["revisionId"]},
            )
            == "Agency"
        )
        before = session.scalar(text("SELECT count(*) FROM dms.posting_batch"))
        key = uuid4()
        service(session, actor).replay(trading[0], key, permission="cash.receipt.post")
        service(session, actor).replay(trading[0], key, permission="cash.receipt.post")
        commit(session)
        assert session.scalar(text("SELECT count(*) FROM dms.posting_batch")) == before
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            service(session, actor).post_receipt(receipt, uuid4())


def test_manual_overpay_and_future_invoice_fail_without_persisted_effects(engine, actor, trading):
    with Session(engine) as session:
        issue(session, actor, trading, day=5)
        commit(session)
        for amount, day in ((103, 6), (1, 4), (0, 6)):
            receipt = financial(session, actor, trading[0], amount, day=day)
            with pytest.raises((ApiError, ValueError)):
                service(session, actor).post_receipt(receipt, uuid4())
            session.rollback()
            assert (
                session.scalar(text("SELECT id FROM dms.document WHERE id=:id"), {"id": receipt})
                is None
            )
        assert session.scalar(text("SELECT count(*) FROM dms.credit_lot")) == 0
        assert session.scalar(text("SELECT count(*) FROM dms.receivable_entry")) == 1


def test_internal_charge_and_auto_receipt_share_one_checkpoint(engine, actor, trading):
    with Session(engine) as session:
        repo = DocumentRepository(session)
        from tests.integration.catalogues.helpers import install_builders

        install_builders(session, actor)
        identifier = session.scalar(
            text("""
            SELECT pg_temp.stock_draft('STOCK_ISSUE',:agency,DATE '2026-01-02',
              jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
                'quantity',1)),gen_random_uuid())
        """),
            {"agency": trading[0], "product": trading[1]},
        )
        session.execute(text("SELECT pg_temp.ready(:id,40)"), {"id": identifier})
        revision = repo.document(identifier)["currentRevisionId"]
        confirmation = session.scalar(
            text("""
            INSERT INTO dms.upfront_confirmation ("issueRevisionId",amount,method,"receivedAt",
              "verifiedBy","evidenceReference") VALUES (:id,40,'CASH',clock_timestamp(),
                :actor,'synthetic-confirmed-cash') RETURNING id
        """),
            {"id": revision, "actor": actor},
        )
        mark_posted(session, actor, identifier)
        batch = session.scalar(
            text('SELECT id FROM dms.posting_batch WHERE "revisionId"=:id'), {"id": revision}
        )
        InventoryRepository(session).append(
            batch,
            repo.lines(revision),
            date(2026, 1, 2),
            repo.document(identifier)["businessOrder"],
            direction=-1,
        )
        receipt = financial(
            session, actor, trading[0], 40, day=2, receipt="AUTO_FROM_ISSUE", origin=identifier
        )
        plan = service(session, actor).post_receipt(receipt, uuid4())
        session.execute(
            text("""
            UPDATE dms.upfront_confirmation SET state='CONSUMED',"receiptDocumentId"=:receipt
            WHERE id=:id
        """),
            {"receipt": receipt, "id": confirmation},
        )
        commit(session)
        assert plan.debt == 62
        rows = session.execute(
            text(
                'SELECT "businessDate","businessOrder",amount FROM dms.receivable_entry ORDER BY id'
            )
        ).all()
        assert rows[0][:2] == rows[1][:2] and rows[0].amount == 102 and rows[1].amount == -40


def test_late_online_success_keeps_full_cash_and_creates_excess(engine, actor, trading):
    with Session(engine) as session:
        invoice = issue(session, actor, trading, quantity=3)
        commit(session)
        payment = session.scalar(
            text("""
            INSERT INTO dms.online_payment ("agencyId",provider,"merchantReference",
              "idempotencyKey",amount,"expiresAt","createdBy") VALUES
              (:agency,'LOCAL_TEST','local-test',gen_random_uuid(),200,
                clock_timestamp()+interval '1 day',:actor) RETURNING id
        """),
            {"agency": trading[0], "actor": actor},
        )
        manual = financial(session, actor, trading[0], 200)
        service(session, actor).post_receipt(manual, uuid4())
        commit(session)
        online = financial(session, actor, trading[0], 200, day=4, method="ONLINE")
        plan = service(session, actor).post_receipt(online, uuid4())
        session.execute(
            text("""
            INSERT INTO dms.payment_event
              ("paymentId","eventKey","providerStatus","verifiedPayload")
            VALUES (:id,'verified-local-success','SUCCESS',jsonb_build_object('synthetic',true))
        """),
            {"id": payment},
        )
        session.execute(
            text("""
            UPDATE dms.online_payment SET status='SUCCESS',"receiptDocumentId"=:receipt,
              "providerTransactionId"='local-success',"paymentTime"=clock_timestamp() WHERE id=:id
        """),
            {"receipt": online, "id": payment},
        )
        commit(session)
        assert plan.debt == 0 and plan.credit == 94
        assert SettlementRepository(session).available(trading[0])[0]["available"] == 94
        assert SettlementRepository(session).lots(trading[0])[0].key.receipt_id == online
        assert SettlementRepository(session).source(invoice)["totalAmount"] == 306


def test_wrong_source_missing_agency_date_and_late_authorization(engine, actor, trading):
    with Session(engine) as session:
        identifier = issue(session, actor, trading)
        commit(session)
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            service(session, actor).post_receipt(identifier, uuid4())
        for operation in (
            lambda: SettlementRepository(session).source(999999),
            lambda: SettlementRepository(session).lock_agency(999999),
            lambda: SettlementRepository(session).balance(999999),
        ):
            with pytest.raises(ApiError, match="NOT_FOUND"):
                operation()
        with pytest.raises(ValueError):
            service(session, actor).lock(trading[0], "users.manage")
        receipt = financial(session, actor, trading[0], 1)
        calls = []

        def revoke_after_locks(required):
            calls.append(required)
            if len(calls) == 2:
                raise AuthError(403, "FORBIDDEN", "Revoked")

        with pytest.raises(AuthError):
            service(session, actor, revoke_after_locks).post_receipt(receipt, uuid4())
        assert SettlementRepository(session).source(receipt)["state"] == "DRAFT"
        session.rollback()
        receipt = financial(session, actor, trading[0], 1)
        with (
            patch.object(
                SettlementRepository, "lock_agency", return_value={"acceptedDate": date(2026, 1, 5)}
            ),
            pytest.raises(ApiError, match="AGENCY_CONFLICT"),
        ):
            service(session, actor).post_receipt(receipt, uuid4())
        session.rollback()


@pytest.mark.parametrize("stage", ["append", "commit"])
def test_mutation_and_commit_failure_roll_back_all_effects(engine, actor, trading, stage):
    with Session(engine) as session:
        issue(session, actor, trading)
        commit(session)
        original_count = session.scalar(text("SELECT count(*) FROM dms.audit_log"))
        receipt = financial(session, actor, trading[0], 30)
        real = SettlementRepository.append

        def failing_append(repository, *args):
            real(repository, *args)
            raise RuntimeError("injected after persisted ledger leg")

        target = (
            (SettlementRepository, "append", failing_append)
            if stage == "append"
            else (session, "commit", lambda: (_ for _ in ()).throw(RuntimeError("commit failed")))
        )
        with patch.object(target[0], target[1], target[2]), pytest.raises(RuntimeError):
            service(session, actor).post_receipt(receipt, uuid4())
            commit(session)
        session.rollback()
        assert (
            session.scalar(text("SELECT id FROM dms.document WHERE id=:id"), {"id": receipt})
            is None
        )
        assert session.scalar(text("SELECT count(*) FROM dms.receivable_entry")) == 1
        assert session.scalar(text("SELECT count(*) FROM dms.audit_log")) == original_count


def test_repository_rejects_invalid_ledgers_and_database_guards_append_only(engine, actor, trading):
    with Session(engine) as session:
        identifier = issue(session, actor, trading)
        commit(session)
        repo = SettlementRepository(session)
        for operation in (
            lambda: repo.effective(1, "unsafe"),
            lambda: repo.append(None, 1, Leg("unsafe", "CHARGE", 1, Decimal(1)), 1),
            lambda: repo.reverse(1, "unsafe", {}),
            lambda: repo.finish_reservations(1, "ACTIVE"),
        ):
            with pytest.raises(ValueError):
                operation()
        with pytest.raises(DBAPIError):
            session.execute(text("UPDATE dms.receivable_entry SET amount=1"))
        session.rollback()
        assert repo.source(identifier)["status"] == "POSTED"
