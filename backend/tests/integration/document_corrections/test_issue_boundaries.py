from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.stock_issues.schemas import StockIssueCreate
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.helpers import install_builders, product
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.test_issues import (
    ready_with_money,
    replacement,
    token,
    use_case,
)
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_issue_new_product_price_source_override_and_historical_stock_are_atomic(
    engine, actor, trading
):
    with Session(engine) as session:
        install_builders(session, actor)
        unit = session.scalar(
            text('SELECT "unitId" FROM dms.product WHERE id=:id'), {"id": trading[1]}
        )
        other = product(session, unit)
        identifier = issue(session, actor, trading, quantity=3)
        commit(session)
    before = snapshot(engine)
    for body, code in (
        (replacement(other), "PRICE_SOURCE_REQUIRED"),
        (replacement(trading[1], "1001"), "STOCK_CONFLICT"),
        (replacement(trading[1], businessDate="2025-12-31"), "AGENCY_CONFLICT"),
    ):
        with Session(engine) as session, pytest.raises(ApiError) as error:
            use_case(session, actor).correct(
                identifier, body, token(engine, actor, identifier), uuid4()
            )
        assert error.value.code == code
        assert snapshot(engine) == before
    with Session(engine) as session:
        install_builders(session, actor)
        opening = session.scalar(
            text("""SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-01',
            jsonb_build_array(jsonb_build_object('product',CAST(:id AS bigint),
            'quantity',100,'price',200)),gen_random_uuid())"""),
            {"id": other},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": opening})
        commit(session)
        service = use_case(session, actor)
        changed = service.correct(
            identifier, replacement(other), token(engine, actor, identifier), uuid4()
        )
        assert changed.body["totalAmount"] == "612"
        overridden = service.correct(
            identifier,
            replacement(
                other,
                sellingPriceRate="2",
                lines=[{"productId": str(other), "quantity": "3", "basePurchasePrice": "150"}],
            ),
            token(engine, actor, identifier),
            uuid4(),
        )
        assert overridden.body["totalAmount"] == "900"


def test_upfront_replacement_cannot_remove_received_money(engine, actor, trading):
    identifier = ready_with_money(engine, actor, trading, posted=True)
    before = snapshot(engine)
    with Session(engine) as session, pytest.raises(ApiError, match="INVALID_TOTAL"):
        use_case(session, actor).correct(
            identifier,
            replacement(
                trading[1],
                sellingPriceRate="1",
                lines=[{"productId": str(trading[1]), "quantity": "1", "basePurchasePrice": "1"}],
            ),
            token(engine, actor, identifier),
            uuid4(),
        )
    assert snapshot(engine) == before


def test_draft_issue_cancel_is_neutral_and_repeated_fresh_action_is_rejected(
    engine, actor, trading
):
    with Session(engine) as session:
        service = use_case(session, actor)
        draft = service.owner.create(
            StockIssueCreate(agencyId=str(trading[0]), businessDate="2026-01-02"), uuid4()
        )
        identifier = int(draft.body["id"])
    before = snapshot(engine)
    with Session(engine) as session:
        result = use_case(session, actor).cancel(
            identifier, Reason(reason="Unused draft"), token(engine, actor, identifier), uuid4()
        )
    assert result.body["status"] == "CANCELLED"
    after = snapshot(engine)
    for table in ("inventory_entry", "receivable_entry", "credit_entry", "posting_batch"):
        assert after[table] == before[table]
    with Session(engine) as session, pytest.raises(ApiError, match="STATE_CONFLICT"):
        use_case(session, actor).cancel(
            identifier,
            Reason(reason="Already cancelled"),
            token(engine, actor, identifier),
            uuid4(),
        )
    assert snapshot(engine) == after


def test_cancel_issue_rejects_stock_overflow_after_later_replenishment(engine, actor, trading):
    with Session(engine) as session:
        install_builders(session, actor)
        identifier = issue(session, actor, trading, quantity=3)
        commit(session)
        install_builders(session, actor)
        later = session.scalar(
            text("""SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-03',
            jsonb_build_array(jsonb_build_object('product',CAST(:id AS bigint),
            'quantity',999999999999002,'price',1)),gen_random_uuid())"""),
            {"id": trading[1]},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": later})
        commit(session)
    before = snapshot(engine)
    with Session(engine) as session, pytest.raises(ApiError, match="STOCK_OVERFLOW"):
        use_case(session, actor).cancel(
            identifier,
            Reason(reason="False issue"),
            token(engine, actor, identifier),
            uuid4(),
        )
    assert snapshot(engine) == before
