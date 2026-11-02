from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.stock_receipts.schemas import Reason
from tests.integration.document_corrections.manual_helpers import (
    manual_body,
    manual_condition,
    manual_service,
    timeline,
)

pytestmark = pytest.mark.integration


def period_oracle(engine, agency):
    with engine.connect() as connection:
        sources = dict(
            connection.execute(
                text("""SELECT r."businessDate",sum(CASE WHEN d.kind='STOCK_ISSUE'
                THEN r."totalAmount" WHEN d.kind='PAYMENT_RECEIPT' THEN -r."totalAmount"
                ELSE 0 END) FROM dms.document d JOIN dms.document_revision r
                ON r.id=d."currentRevisionId" WHERE d."agencyId"=:agency
                AND d.status='POSTED' GROUP BY r."businessDate" ORDER BY r."businessDate"
                """),
                {"agency": agency},
            ).all()
        )
        ledger = dict(
            connection.execute(
                text("""SELECT "businessDate",sum(amount) FROM dms.receivable_entry
                WHERE "agencyId"=:agency GROUP BY "businessDate"
                HAVING sum(amount)<>0 ORDER BY "businessDate"
                """),
                {"agency": agency},
            ).all()
        )
        assert ledger == {day: amount for day, amount in sources.items() if amount}
        assert sum(ledger.values(), Decimal(0)) == connection.scalar(
            text('SELECT "currentDebt" FROM dms.agency_balance WHERE "agencyId"=:agency'),
            {"agency": agency},
        )
        return ledger


def test_manual_move_and_cancel_restate_original_period_independently(engine, actor, trading):
    _, receipts = timeline(engine, actor, trading)
    identifier = receipts[0]
    expected = {
        date(2026, 1, 2): Decimal(204),
        date(2026, 1, 3): Decimal(-150),
        date(2026, 1, 4): Decimal(204),
        date(2026, 1, 5): Decimal(-200),
        date(2026, 1, 6): Decimal(204),
        date(2026, 1, 7): Decimal(-200),
    }
    assert period_oracle(engine, trading[0]) == expected
    with Session(engine) as session:
        manual_service(session, actor).correct(
            identifier,
            manual_body("100", day="2026-01-08"),
            manual_condition(engine, actor, identifier),
            uuid4(),
        )
    del expected[date(2026, 1, 3)]
    expected[date(2026, 1, 8)] = Decimal(-100)
    assert period_oracle(engine, trading[0]) == expected
    with Session(engine) as session:
        manual_service(session, actor).cancel(
            identifier,
            Reason(reason="False original record"),
            manual_condition(engine, actor, identifier),
            uuid4(),
        )
    del expected[date(2026, 1, 8)]
    assert period_oracle(engine, trading[0]) == expected
