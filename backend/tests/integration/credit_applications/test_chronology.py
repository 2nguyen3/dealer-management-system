from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from tests.integration.catalogues.helpers import install_builders
from tests.integration.credit_applications.test_service import create, service
from tests.integration.settlement_core.helpers import commit, issue
from tests.integration.settlement_core.test_reservations import credit_cash

pytestmark = pytest.mark.integration


def test_multiple_lots_invoices_and_return_preserve_original_cash(engine, actor, trading):
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        sources = [credit_cash(session, actor, (agency, product), 100)[0] for _ in range(2)]
        first = issue(session, actor, (agency, product), day=4)
        second = issue(session, actor, (agency, product), day=4)
        commit(session)
        use = service(session, actor)
        created = create(use, agency, "200")
        posted = use.post(int(created.body["id"]), Preconditions(created.headers["ETag"]), uuid4())
        assert posted.body["agencyBalance"]["currentDebt"] == "4"
        install_builders(session, actor)
        line = session.scalar(
            text(
                "SELECT l.id FROM dms.document_line l JOIN dms.document d "
                'ON d."currentRevisionId"=l."revisionId" WHERE d.id=:id'
            ),
            {"id": first},
        )
        returned = session.scalar(
            text("""
            SELECT pg_temp.stock_draft('SALES_RETURN',:agency,DATE '2026-01-06',
              jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
                'quantity',1,'price',102,'originLine',CAST(:line AS bigint),'returnAmount',102)),
              gen_random_uuid(),:origin)
        """),
            {"agency": agency, "product": product, "line": line, "origin": first},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": returned})
        use.settlement.replay(agency, uuid4(), permission="returns.post")
        commit(session)
    with engine.connect() as connection:
        # First invoice used all100 from source1 and2 from source2; the full return
        # must restore precisely these sources, not any same-agency receipt.
        restored = connection.execute(
            text(
                'SELECT l."originReceiptId",sum(e.amount) '
                'FROM dms.credit_lot l JOIN dms.credit_entry e ON e."lotId"=l.id '
                'JOIN dms.document_revision r ON r.id=l."sourceRevisionId" '
                'WHERE r."documentId"=:id GROUP BY 1 ORDER BY 1'
            ),
            {"id": returned},
        ).all()
        assert restored == [(sources[0], 100), (sources[1], 2)]
        debts = connection.execute(
            text(
                'SELECT "issueDocumentId",sum(amount) '
                "FROM dms.receivable_entry GROUP BY 1 ORDER BY 1"
            )
        ).all()
        assert debts == [(first, 0), (second, 4)]
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'")
            )
            == 2
        )


def test_future_credit_rejected_then_valid_backdated_application_replays_later_application(
    engine, actor, trading
):
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=2)
        credit_cash(session, actor, (agency, product), 200)
        issue(session, actor, (agency, product), day=4, quantity=3)
        commit(session)
        use = service(session, actor)
        future = create(use, agency, "1", "2026-01-02")
        with pytest.raises(ApiError, match="INSUFFICIENT_CREDIT"):
            use.post(int(future.body["id"]), Preconditions(future.headers["ETag"]), uuid4())
        later = create(use, agency, "40", "2026-01-07")
        use.post(int(later.body["id"]), Preconditions(later.headers["ETag"]), uuid4())
        earlier = create(use, agency, "40", "2026-01-05")
        result = use.post(int(earlier.body["id"]), Preconditions(earlier.headers["ETag"]), uuid4())
        assert result.body["agencyBalance"]["currentDebt"] == "226"
        assert result.body["agencyBalance"]["currentCredit"] == "18"
    with engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT sum(amount) FROM dms.credit_entry WHERE kind='OFFSET'"))
            == -80
        )
        assert (
            connection.scalar(
                text("SELECT status FROM dms.document WHERE id=:id"), {"id": int(future.body["id"])}
            )
            == "DRAFT"
        )
