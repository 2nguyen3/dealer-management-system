from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.db.seed import main as seed_demo
from app.modules.document_core.repository import DocumentRepository
from app.modules.sales_returns.schemas import SalesReturnCreate
from app.modules.sales_returns.service import SalesReturnService
from app.modules.stock_receipts.schemas import Reason
from app.modules.upfront_payments.service import UpfrontPaymentService
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.manual_helpers import (
    manual_body,
    manual_condition,
    manual_service,
)
from tests.integration.settlement_core.helpers import commit, financial, issue, mark_posted
from tests.integration.settlement_core.test_reservations import refund, reservations

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("paid", [False, True])
def test_manual_source_correction_preserves_or_blocks_reserved_and_paid_refund_money(
    engine, actor, trading, paid
):
    with Session(engine) as session:
        invoice = issue(session, actor, trading, quantity=3)
        commit(session)
        receipt = financial(session, actor, trading[0], 306)
        manual_service(session, actor).settlement.post_receipt(receipt, uuid4())
        commit(session)
        origin = DocumentRepository(session).lines(
            DocumentRepository(session).document(invoice)["currentRevisionId"]
        )[0]
        returns = SalesReturnService(
            session, CursorCodec(b"x" * 32), actor, "m29-real-return", lambda _: None
        )
        draft = returns.create(
            SalesReturnCreate(
                originDocumentId=str(invoice),
                businessDate="2026-01-04",
                lines=[{"originLineId": str(origin["id"]), "quantity": "1"}],
            ),
            uuid4(),
        )
        returns.post(int(draft.body["id"]), Preconditions(draft.headers["ETag"]), uuid4())
        requested = refund(session, actor, trading[0], receipt, 20)
        reservations(session, actor).reserve(requested)
        commit(session)
        if paid:
            mark_posted(session, actor, requested)
            reservations(session, actor).consume(requested, uuid4())
            commit(session)
    before = snapshot(engine)
    with Session(engine) as session:
        corrected = manual_service(session, actor).correct(
            receipt, manual_body("296"), manual_condition(engine, actor, receipt), uuid4()
        )
    assert corrected.body["agencyBalance"]["currentCredit"] == ("72" if paid else "92")
    after = snapshot(engine)
    assert after["refund_reservation"] == before["refund_reservation"]
    assert after["refund_attempt"] == before["refund_attempt"]
    assert after["document_revision"][:-1] == before["document_revision"]
    token = Preconditions(corrected.headers["ETag"])
    for correcting in (True, False):
        with Session(engine) as session, pytest.raises(ApiError) as error:
            use_case = manual_service(session, actor)
            if correcting:
                use_case.correct(receipt, manual_body("100"), token, uuid4())
            else:
                use_case.cancel(receipt, Reason(reason="Cannot erase real payout"), token, uuid4())
        assert error.value.code == ("REFUND_SOURCE_CONFLICT" if paid else "CREDIT_RESERVED")
        assert snapshot(engine) == after


def test_posted_online_auto_and_separated_receipts_are_protected_in_full_seed(database_factory):
    with database_factory() as engine:
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch(
                "app.db.seed.get_settings",
                return_value=SimpleNamespace(database_url=lambda: engine.url),
            ),
        ):
            seed_demo()
        with engine.connect() as connection:
            actor = connection.scalar(text("SELECT min(id) FROM dms.app_user"))
            verified = connection.scalar(
                text("""
                SELECT u.id FROM dms.upfront_confirmation u
                JOIN dms.document d ON d."currentRevisionId"=u."issueRevisionId"
                WHERE u.state='VERIFIED' AND d.status='PENDING' ORDER BY u.id LIMIT 1
                """)
            )
        assert verified is not None
        # Seed carries VERIFIED money, not an already separated receipt. Exercise the
        # actual M19 seam to create that protected source in this isolated fixture.
        with Session(engine) as session:
            upfront = UpfrontPaymentService(
                session, CursorCodec(b"x" * 32), actor, "m29-seed-separation", lambda _: None
            )
            found = upfront.get(verified)
            separated = upfront.separate(
                verified,
                Reason(reason="Isolated verified money separation"),
                Preconditions(upfront.etag(found)),
                uuid4(),
            )
            assert separated.body["receipt"]["receiptType"] == "RECEIVED_UNAPPLIED"
        with engine.connect() as connection:
            identifiers = connection.execute(
                text("""
                SELECT min(d.id),d."receiptType",r."paymentMethod" FROM dms.document d
                JOIN dms.document_revision r ON r.id=d."currentRevisionId"
                WHERE d.kind='PAYMENT_RECEIPT' AND d.status='POSTED'
                  AND (d."receiptType" IN ('AUTO_FROM_ISSUE','RECEIVED_UNAPPLIED')
                    OR r."paymentMethod"='ONLINE')
                GROUP BY d."receiptType",r."paymentMethod"
                """)
            ).all()
        assert {row[1] for row in identifiers} >= {"AUTO_FROM_ISSUE", "RECEIVED_UNAPPLIED"}
        assert any(row[2] == "ONLINE" for row in identifiers)
        before = snapshot(engine)
        for identifier, _, _ in identifiers:
            token = manual_condition(engine, actor, identifier)
            for correcting in (True, False):
                with Session(engine) as session, pytest.raises(ApiError) as error:
                    use_case = manual_service(session, actor)
                    if correcting:
                        use_case.correct(identifier, manual_body(), token, uuid4())
                    else:
                        use_case.cancel(
                            identifier, Reason(reason="Protected source"), token, uuid4()
                        )
                assert error.value.code == "RECEIPT_CONFLICT"
            assert snapshot(engine) == before
