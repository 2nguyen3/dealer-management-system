from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.document_core.repository import DocumentRepository
from app.modules.settlement_core.models import Leg, LotKey
from app.modules.settlement_core.repository import SettlementRepository
from tests.integration.settlement_core.helpers import commit, financial, issue, mark_posted, service
from tests.integration.settlement_core.test_reservations import credit_cash, refund, reservations

pytestmark = pytest.mark.integration


def test_backdated_receipt_replays_credit_application_return_and_paid_refund_provenance(
    engine, actor, trading
):
    with Session(engine) as session:
        first = issue(session, actor, trading)
        cash, _ = credit_cash(session, actor, trading, 200)
        issue(session, actor, trading, day=5)
        application = financial(
            session,
            actor,
            trading[0],
            98,
            day=6,
            kind="CREDIT_APPLICATION",
            method=None,
            receipt=None,
        )
        mark_posted(session, actor, application)
        service(session, actor).replay(trading[0], uuid4(), permission="credit.apply")
        origin_line = session.scalar(
            text(
                "SELECT l.id FROM dms.document_line l "
                'JOIN dms.document d ON d."currentRevisionId"=l."revisionId" '
                "WHERE d.id=:id"
            ),
            {"id": first},
        )
        returned = session.scalar(
            text("""
            SELECT pg_temp.stock_draft('SALES_RETURN',:agency,DATE '2026-01-07',
              jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
                'quantity',1,'price',102,'originLine',CAST(:line AS bigint),'returnAmount',102)),
              gen_random_uuid(),:origin)
        """),
            {"agency": trading[0], "product": trading[1], "line": origin_line, "origin": first},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": returned})
        service(session, actor).replay(trading[0], uuid4(), permission="returns.post")
        requested = refund(session, actor, trading[0], cash, 60)
        # Actual refund date must follow its credit source.
        revision = SettlementRepository(session).source(requested)["revisionId"]
        session.execute(
            text('UPDATE dms.document_revision SET "businessDate"=:date WHERE id=:id'),
            {"date": date(2026, 1, 8), "id": revision},
        )
        reservations(session, actor).reserve(requested)
        commit(session)
        mark_posted(session, actor, requested)
        reservations(session, actor).consume(requested, uuid4())
        commit(session)
        protected = session.execute(
            text(
                "SELECT to_jsonb(e) FROM dms.credit_entry e "
                'JOIN dms.posting_batch b ON b.id=e."batchId" '
                'WHERE b."revisionId"=:id ORDER BY e.id'
            ),
            {"id": revision},
        ).all()
        frozen = session.execute(
            text("SELECT to_jsonb(r) FROM dms.document_revision r ORDER BY id")
        ).all()
        old_reserved = session.execute(
            text("SELECT to_jsonb(x) FROM dms.refund_reservation x ORDER BY id")
        ).all()
        backdated = financial(session, actor, trading[0], 10, day=2)
        plan = service(session, actor).post_receipt(backdated, uuid4())
        commit(session)
        assert plan.debt == 4 and plan.credit == 52
        assert (
            session.execute(
                text(
                    "SELECT to_jsonb(e) FROM dms.credit_entry e "
                    'JOIN dms.posting_batch b ON b.id=e."batchId" '
                    'WHERE b."revisionId"=:id ORDER BY e.id'
                ),
                {"id": revision},
            ).all()
            == protected
        )
        assert (
            session.execute(
                text("SELECT to_jsonb(x) FROM dms.refund_reservation x ORDER BY id")
            ).all()
            == old_reserved
        )
        assert (
            session.execute(
                text("SELECT to_jsonb(r) FROM dms.document_revision r WHERE id<=:last ORDER BY id"),
                {"last": frozen[-1][0]["id"]},
            ).all()
            == frozen
        )
        repo = SettlementRepository(session)
        return_lots = [
            lot
            for lot in repo.lots(trading[0])
            if lot.key.revision_id == repo.source(returned)["revisionId"]
        ]
        assert {lot.key.receipt_id: lot.created for lot in return_lots} == {
            cash: Decimal(92),
            backdated: Decimal(10),
        }
        assert (
            session.scalar(
                text('SELECT count(*) FROM dms.credit_entry WHERE "reversesEntryId" IS NOT NULL')
            )
            == 2
        )


def test_backdated_issue_cannot_destroy_reserved_cash_source(engine, actor, trading):
    with Session(engine) as session:
        cash, _ = credit_cash(session, actor, trading)
        requested = refund(session, actor, trading[0], cash, 100)
        reservations(session, actor).reserve(requested)
        commit(session)
        original = session.execute(text("SELECT id,amount FROM dms.credit_entry ORDER BY id")).all()
        backdated = issue(session, actor, trading, day=2)
        with pytest.raises(ApiError, match="CREDIT_RESERVED"):
            service(session, actor).replay(trading[0], uuid4(), permission="stock.issue.post")
        session.rollback()
        assert (
            session.scalar(text("SELECT id FROM dms.document WHERE id=:id"), {"id": backdated})
            is None
        )
        assert (
            session.execute(text("SELECT id,amount FROM dms.credit_entry ORDER BY id")).all()
            == original
        )
        assert SettlementRepository(session).balance(trading[0])["reserved"] == 100


@pytest.mark.parametrize("paid", [False, True])
def test_duplicate_source_lots_keep_later_lot_reservation_or_refund_after_backdated_issue(
    engine, actor, trading, paid
):
    with Session(engine) as session:
        cash, _ = credit_cash(session, actor, trading, 200)
        core = service(session, actor)
        repo = core.repo
        source = repo.source(cash)
        event = next(e for e in repo.events(trading[0]) if e.document_id == cash)
        first = repo.lots(trading[0])[0]
        second_id = repo.ensure_lot(trading[0], LotKey(source["revisionId"], cash))
        batch = DocumentRepository(session).append_batch(
            source["revisionId"], "REALLOCATE", uuid4(), actor
        )
        original = repo.effective(source["revisionId"], "credit")[0]
        repo.reverse(batch, "credit", original)
        repo.append(event, batch, Leg("credit", "CREATED", first.key, Decimal(120)), first.key.id)
        second = LotKey(source["revisionId"], cash, second_id)
        repo.append(event, batch, Leg("credit", "CREATED", second, Decimal(80)), second_id)
        hold_first = refund(session, actor, trading[0], cash, 120)
        hold_second = refund(session, actor, trading[0], cash, 80)
        reservations(session, actor).reserve(hold_first)
        assert reservations(session, actor).reserve(hold_second) == ((second_id, Decimal(80)),)
        reservations(session, actor).release(hold_first)
        commit(session)
        if paid:
            mark_posted(session, actor, hold_second)
            reservations(session, actor).consume(hold_second, uuid4())
            commit(session)
        issue(session, actor, trading, day=2)
        plan = core.replay(trading[0], uuid4(), permission="stock.issue.post")
        commit(session)
        assert plan.credit == (18 if paid else 98)
        assert {lot.key.id: lot.created for lot in repo.lots(trading[0])} == {
            first.key.id: Decimal(18),
            second_id: Decimal(80),
        }
        assert repo.reservations(repo.source(hold_second)["revisionId"])[0]["state"] == (
            "CONSUMED" if paid else "ACTIVE"
        )
