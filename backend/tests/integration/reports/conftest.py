import os
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.helpers import (
    agency,
    draft,
    install_builders,
    post_stock,
    product,
)
from tests.integration.document_corrections.test_issues import replacement
from tests.integration.document_corrections.test_issues import use_case as issue_corrections
from tests.integration.document_corrections.test_return_credit import match, post_return, returns
from tests.integration.sales_returns.test_protected_rounding import fractional_trading
from tests.integration.settlement_core.conftest import trading  # noqa: F401
from tests.integration.settlement_core.helpers import commit, financial, issue, mark_posted, service
from tests.integration.settlement_core.test_reservations import refund, reservations
from tests.integration.user_groups.conftest import actor, client, engine  # noqa: F401
from tests.support.database import selected_database_factory


@pytest.fixture(scope="session")
def database_factory():
    # Guard before entering the shared factory: never fall back to CREATE DATABASE.
    if os.environ.get("SUPABASE_TEST_SCHEMAS") != "1":
        pytest.fail("M30 fixtures require Supabase UUID schemas: SUPABASE_TEST_SCHEMAS=1")
    with selected_database_factory(suite="business") as create:
        yield create


@pytest.fixture
def report_scenario(engine, actor, trading):  # noqa: F811
    """Committed small report witness; IDs, not duplicate display names, identify facts."""
    fractional = fractional_trading(engine, actor, {"agency": str(trading[0])})
    fractional_product = int(fractional["product"])
    with Session(engine) as session:
        original = issue(session, actor, trading, quantity=3)
        cash = financial(session, actor, trading[0], 306)
        service(session, actor).post_receipt(cash, uuid4())
        commit(session)
        owner = returns(session, actor)
        line = owner.core.repo.lines(owner.core.repo.document(original)["currentRevisionId"])[0]
        returned = post_return(owner, original, line["id"], "2", "2026-01-04")
        paid = refund(session, actor, trading[0], cash, 40)
        reservations(session, actor).reserve(paid)
        commit(session)
        mark_posted(session, actor, paid)
        reservations(session, actor).consume(paid, uuid4())
        commit(session)
        reserved = refund(session, actor, trading[0], cash, 50)
        reservations(session, actor).reserve(reserved)
        commit(session)
        fractional_issue = issue(session, actor, (trading[0], fractional_product), quantity=3)
        commit(session)
        # Non-success provider records have no posted cash/ledger source. Reports
        # must not promote setup, failure or expiry evidence into received money.
        session.execute(
            text("""INSERT INTO dms.online_payment
              ("agencyId",provider,"merchantReference","idempotencyKey",amount,status,"expiresAt")
              SELECT :agency,'REPORT_FIXTURE','m30-'||state,gen_random_uuid(),1,'PENDING',
                clock_timestamp()+interval '1 day'
              FROM unnest(ARRAY['PENDING','FAILED','EXPIRED']) AS state"""),
            {"agency": trading[0]},
        )
        session.execute(
            text("""UPDATE dms.online_payment
          SET status=substring("merchantReference" FROM 5)
          WHERE "merchantReference" IN ('m30-FAILED','m30-EXPIRED')""")
        )
        commit(session)
        fractional_line = owner.core.repo.lines(
            owner.core.repo.document(fractional_issue)["currentRevisionId"]
        )[0]
        zero_return = post_return(
            owner, fractional_issue, fractional_line["id"], "0.25", "2026-02-03"
        )
        install_builders(session, actor)
        other_agency = agency(session)
        changed = issue(session, actor, (other_agency, trading[1]), quantity=3)
        discarded = issue(session, actor, (other_agency, trading[1]), quantity=1)
        commit(session)
        correction = issue_corrections(session, actor)
        correction.correct(
            changed,
            replacement(trading[1], "2", businessDate="2026-02-02"),
            match(correction.owner, changed),
            uuid4(),
        )
        correction.cancel(
            discarded,
            Reason(reason="Report cancellation witness"),
            match(correction.owner, discarded),
            uuid4(),
        )
    return {
        "agencies": (trading[0], other_agency),
        "products": (trading[1], fractional_product),
        "issue": original,
        "receipt": cash,
        "return": returned,
        "corrected_issue": changed,
        "cancelled_issue": discarded,
        "zero_return": zero_return,
        "paid_refund": paid,
        "reserved_refund": reserved,
        "current_credit": 164,
        "current_reserved": 50,
        "current_available": 114,
    }


@pytest.fixture
def historical_inventory_scenario(engine, actor):  # noqa: F811
    """Existing D14 shape: historical 1.2e15, current 7e14; no cache writes."""
    with Session(engine) as session:
        install_builders(session, actor)
        session.execute(text('UPDATE dms.agency_type SET "maxDebt"=900000000000000000 WHERE id=1'))
        agency_id = agency(session)
        unit = session.scalar(
            text("INSERT INTO dms.unit (code,name) VALUES ('HIST','Historical') RETURNING id")
        )
        product_id = product(session, unit)
        receipts = []
        for position in range(2):
            incoming = draft(session, product_id, quantity="600000000000000")
            session.execute(
                text(
                    "UPDATE dms.document_revision SET \"businessDate\"=DATE '2026-01-01' "
                    'WHERE "documentId"=:id'
                ),
                {"id": incoming},
            )
            post_stock(session, incoming)
            receipts.append(incoming)
            if position == 0:
                outgoing = draft(
                    session,
                    product_id,
                    quantity="500000000000000",
                    kind="STOCK_ISSUE",
                    agency_id=agency_id,
                )
                post_stock(session, outgoing)
        commit(session)
    return {
        "agency": agency_id,
        "product": product_id,
        "unit": unit,
        "receipts": receipts,
        "issue": outgoing,
        "historical_stock": 1200000000000000,
        "current_stock": 700000000000000,
    }
