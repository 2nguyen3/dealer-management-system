from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.core.exceptions import ApiError
from app.modules.agency_credit.service import AgencyCreditService, AvailableCreditService
from tests.integration.settlement_core.helpers import commit
from tests.integration.settlement_core.test_reservations import credit_cash, refund, reservations
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_reserved_lot_pages_historical_totals_and_internal_availability(engine, actor, trading):
    agency_id = int(trading["agency"])
    with Session(engine) as session:
        pair = (agency_id, int(trading["product"]))
        first, _ = credit_cash(session, actor, pair, 200)
        second, _ = credit_cash(session, actor, pair, 100)
        commit(session)
        requested = refund(session, actor, agency_id, first, 200)
        reservations(session, actor).reserve(requested)
        commit(session)
        use = AgencyCreditService(
            session, CursorCodec(b"x" * 32), actor, "credit-reads", lambda _: None
        )
        available = use.lots(agency_id, availableOnly=True)
        assert len(available.items) == 1 and available.items[0].originReceiptId == str(second)
        held = use.lots(agency_id, originReceiptId=str(first)).items[0]
        assert held.balance == held.reserved == 200 and held.available == 0
        assert use.lot(int(held.id)) == held
        for sort in ("id", "-id", "createdAt", "-createdAt"):
            page = use.lots(agency_id, sort=sort, limit=1)
            assert page.pagination.hasMore
            next_page = use.lots(agency_id, sort=sort, limit=1, cursor=page.pagination.nextCursor)
            assert next_page.items[0].id != page.items[0].id
            with pytest.raises(ApiError, match="INVALID_CURSOR"):
                use.lots(
                    agency_id, sort=sort, cursor=page.pagination.nextCursor, availableOnly=True
                )
        for sort in ("businessDate", "-businessDate"):
            page = use.statement(agency_id, sort=sort, limit=1, effectiveOnly=False)
            assert page.pagination.hasMore and page.closingCredit == 300
            assert_schema(page.model_dump(mode="json"), "CreditStatement")
            after = use.statement(
                agency_id,
                sort=sort,
                limit=1,
                effectiveOnly=False,
                cursor=page.pagination.nextCursor,
            )
            assert after.items[0].id != page.items[0].id and after.closingCredit == 300
        scoped = use.statement(
            agency_id,
            lotId=held.id,
            kind="CREATED",
            sourceDocumentId=str(first),
            toDate=date(2026, 1, 5),
        )
        assert (
            len(scoped.items) == 1
            and scoped.closingCredit == 300
            and scoped.items[0].balanceAfter == 200
        )
        later = use.statement(agency_id, fromDate=date(2026, 1, 5), toDate=date(2026, 1, 6))
        assert later.items == [] and later.openingCredit == later.closingCredit == 300
        internal = AvailableCreditService(session, actor, "available-test", lambda _: None)
        assert (
            internal.available(agency_id, permission="credit.apply", receipt_id=first)[0][
                "available"
            ]
            == 0
        )
        reservations(session, actor).release(requested)
        commit(session)
        assert (
            internal.available(agency_id, permission="cash.refund.post", receipt_id=first)[0][
                "available"
            ]
            == 200
        )
        for query in (
            lambda: use.lot(999999),
            lambda: use.lots(999999),
            lambda: use.statement(999999),
        ):
            with pytest.raises(ApiError, match="NOT_FOUND"):
                query()
        for query in (
            lambda: use.lots(agency_id, sort="bad"),
            lambda: use.statement(agency_id, sort="bad"),
            lambda: use.statement(agency_id, fromDate=date(2026, 1, 2), toDate=date(2026, 1, 2)),
        ):
            with pytest.raises(ApiError, match="VALIDATION_FAILED"):
                query()
