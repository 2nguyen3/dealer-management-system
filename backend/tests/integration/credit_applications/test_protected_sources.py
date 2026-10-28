from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from tests.integration.credit_applications.test_service import create, service
from tests.integration.settlement_core.helpers import commit, issue, mark_posted
from tests.integration.settlement_core.test_reservations import credit_cash, refund, reservations

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("paid", [False, True])
def test_actual_application_preserves_reserved_and_paid_refund_sources(
    engine, actor, trading, paid
):
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        receipt, _ = credit_cash(session, actor, (agency, product), 100)
        issue(session, actor, (agency, product), day=4, quantity=2)
        requested = refund(session, actor, agency, receipt, 50)
        reservations(session, actor).reserve(requested)
        commit(session)
        if paid:
            mark_posted(session, actor, requested)
            reservations(session, actor).consume(requested, uuid4())
            commit(session)
        before = session.execute(
            text("SELECT to_jsonb(r) FROM dms.refund_reservation r ORDER BY id")
        ).all()
        frozen = session.execute(
            text(
                "SELECT to_jsonb(r) FROM dms.document_revision r "
                'JOIN dms.document d ON d.id=r."documentId" WHERE d.id=:id'
            ),
            {"id": requested},
        ).all()
        session.rollback()
        use = service(session, actor)
        application = create(use, agency, "40", "2026-01-04")
        result = use.post(
            int(application.body["id"]), Preconditions(application.headers["ETag"]), uuid4()
        )
        assert result.body["agencyBalance"]["currentCredit"] == ("10" if paid else "60")
        assert result.body["agencyBalance"]["reservedCredit"] == ("0" if paid else "50")
    with engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT to_jsonb(r) FROM dms.refund_reservation r ORDER BY id")
            ).all()
            == before
        )
        assert (
            connection.execute(
                text(
                    "SELECT to_jsonb(r) FROM dms.document_revision r "
                    'JOIN dms.document d ON d.id=r."documentId" WHERE d.id=:id'
                ),
                {"id": requested},
            ).all()
            == frozen
        )
        assert connection.scalar(text('SELECT "originReceiptId" FROM dms.credit_lot')) == receipt
