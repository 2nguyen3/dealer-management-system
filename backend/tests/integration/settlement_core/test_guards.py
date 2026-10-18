from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.settlement_core.models import Leg
from app.modules.settlement_core.repository import SettlementRepository
from tests.integration.settlement_core.helpers import commit, issue, mark_posted, service
from tests.integration.settlement_core.test_reservations import credit_cash, refund, reservations

pytestmark = pytest.mark.integration


def test_current_limit_conflict_rolls_back_backdated_charge(engine, actor, trading):
    with engine.begin() as connection:
        connection.execute(text('UPDATE dms.agency_type SET "maxDebt"=50 WHERE id=1'))
    with Session(engine) as session:
        identifier = issue(session, actor, trading)
        with pytest.raises(ApiError, match="LIMIT_CONFLICT"):
            service(session, actor).replay(trading[0], uuid4(), permission="stock.issue.post")
        session.rollback()
        assert (
            session.scalar(text("SELECT id FROM dms.document WHERE id=:id"), {"id": identifier})
            is None
        )
        assert SettlementRepository(session).balance(trading[0])["debt"] == 0


def test_type_discovery_change_requires_transaction_restart(engine, actor, trading, monkeypatch):
    with Session(engine) as session:
        original = session.scalar
        changed = False

        def scalar(query, *args, **kwargs):
            nonlocal changed
            result = original(query, *args, **kwargs)
            if not changed and str(query).startswith('SELECT "typeId" FROM dms.agency'):
                changed = True
                # Actual independent writer commits between discovery and lock/reread.
                with engine.begin() as connection:
                    connection.execute(
                        text('UPDATE dms.agency SET "typeId"=2 WHERE id=:id'), {"id": trading[0]}
                    )
            return result

        monkeypatch.setattr(session, "scalar", scalar)
        with pytest.raises(DBAPIError) as error:
            SettlementRepository(session).lock_agency(trading[0])
        assert error.value.orig.sqlstate == "40001"
        session.rollback()
        assert SettlementRepository(session).lock_agency(trading[0])["typeId"] == 2


def test_existing_lot_reuse_and_paid_refund_refuses_repair_of_partial_effects(
    engine, actor, trading
):
    with Session(engine) as session:
        receipt, _ = credit_cash(session, actor, trading)
        identifier = refund(session, actor, trading[0], receipt, 60)
        reservations(session, actor).reserve(identifier)
        commit(session)
        repo = SettlementRepository(session)
        lot = repo.lots(trading[0])[0]
        assert repo.ensure_lot(trading[0], lot.key) == lot.key.id
        # Simulate an incomplete owning paid workflow. Replay may not silently repair
        # an already-recorded cash debit of a different amount before final checks.
        mark_posted(session, actor, identifier)
        repo.finish_reservations(repo.source(identifier)["revisionId"], "CONSUMED")
        event = next(e for e in repo.events(trading[0]) if e.document_id == identifier)
        batch = session.scalar(
            text('SELECT id FROM dms.posting_batch WHERE "revisionId"=:id'),
            {"id": event.revision_id},
        )
        repo.append(event, batch, Leg("credit", "REFUND", lot.key, Decimal(-50)), lot.key.id)
        with pytest.raises(ApiError, match="REFUND_SOURCE_CONFLICT"):
            service(session, actor).replay(trading[0], uuid4(), permission="cash.refund.post")
        session.rollback()
        assert repo.source(identifier)["status"] == "DRAFT"
        assert repo.reservations(repo.source(identifier)["revisionId"])[0]["state"] == "ACTIVE"
