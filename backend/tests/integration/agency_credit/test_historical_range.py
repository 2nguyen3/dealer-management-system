from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.modules.agency_credit.service import AgencyCreditService
from tests.integration.catalogues.helpers import install_builders
from tests.integration.settlement_core.helpers import commit, financial, mark_posted, service
from tests.integration.settlement_core.test_reservations import refund, reservations
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_historical_credit_can_exceed_stored_money_reproduction(engine, actor, trading):
    agency_id = int(trading["agency"])
    product_id = int(trading["product"])
    with Session(engine) as session:
        install_builders(session, actor)
        session.execute(text('UPDATE dms.business_rule SET "sellingPriceRate"=1'))
        opening = session.scalar(
            text("""SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,
          DATE '2026-01-01',jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
          'quantity',1,'price',600000000000000000)),gen_random_uuid())"""),
            {"product": product_id},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": opening})
        commit(session)

        def received(day):
            install_builders(session, actor)
            session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
            pending = session.scalar(
                text("""SELECT pg_temp.stock_draft('STOCK_ISSUE',:agency,
              DATE '2026-01-02',jsonb_build_array(jsonb_build_object(
                'product',CAST(:product AS bigint),
                'quantity',1)),gen_random_uuid())"""),
                {"agency": agency_id, "product": product_id},
            )
            session.execute(text("SELECT pg_temp.ready(:id,600000000000000000)"), {"id": pending})
            confirmation = session.scalar(
                text("""INSERT INTO dms.upfront_confirmation
              ("issueRevisionId",amount,method,"receivedAt","verifiedBy")
              SELECT "currentRevisionId",600000000000000000,'CASH',
                CAST(:received AS timestamptz),:actor FROM dms.document
                WHERE id=:id RETURNING id"""),
                {"received": f"2026-01-{day:02d} 10:00:00+07", "actor": actor, "id": pending},
            )
            receipt = financial(
                session, actor, agency_id, 600000000000000000, day=day, receipt="RECEIVED_UNAPPLIED"
            )
            service(session, actor).post_receipt(receipt, uuid4())
            session.execute(
                text("""UPDATE dms.upfront_confirmation SET state='RECEIVED_SEPARATELY',
              "receiptDocumentId"=:receipt WHERE id=:id"""),
                {"receipt": receipt, "id": confirmation},
            )
            commit(session)
            return receipt

        first = received(3)
        requested = refund(session, actor, agency_id, first, 500000000000000000)
        session.execute(
            text(
                "UPDATE dms.document_revision SET \"businessDate\"=DATE '2026-01-06' "
                'WHERE "documentId"=:id'
            ),
            {"id": requested},
        )
        reservations(session, actor).reserve(requested)
        commit(session)
        mark_posted(session, actor, requested)
        reservations(session, actor).consume(requested, uuid4())
        commit(session)
        received(5)
        use = AgencyCreditService(
            session, CursorCodec(b"x" * 32), actor, "historical-credit", lambda _: None
        )
        result = use.statement(agency_id)
        assert max(item.balanceAfter for item in result.items) == 1200000000000000000
        assert result.closingCredit == 700000000000000000
        assert_schema(result.model_dump(mode="json"), "CreditStatement")
        before_payout = use.statement(agency_id, toDate=date(2026, 1, 6))
        assert before_payout.closingCredit == 1200000000000000000
        assert_schema(before_payout.model_dump(mode="json"), "CreditStatement")
        payout_period = use.statement(agency_id, fromDate=date(2026, 1, 6), toDate=date(2026, 1, 7))
        assert payout_period.openingCredit == 1200000000000000000
        assert payout_period.closingCredit == 700000000000000000
        assert_schema(payout_period.model_dump(mode="json"), "CreditStatement")
        assert (
            session.scalar(
                text('SELECT "currentCredit" FROM dms.agency_balance WHERE "agencyId"=:id'),
                {"id": agency_id},
            )
            == 700000000000000000
        )
