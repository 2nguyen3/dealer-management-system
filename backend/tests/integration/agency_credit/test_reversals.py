from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.modules.agency_credit.service import AgencyCreditService
from tests.integration.settlement_core.helpers import commit, issue, service
from tests.integration.settlement_core.test_reservations import credit_cash
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_reallocated_credit_keeps_reversal_history_and_atomic_balances(engine, actor, trading):
    pair = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        cash, _ = credit_cash(session, actor, pair, 100)
        commit(session)
        issue(session, actor, pair, day=2)
        service(session, actor).replay(pair[0], uuid4(), permission="stock.issue.post")
        commit(session)
        use = AgencyCreditService(
            session, CursorCodec(b"x" * 32), actor, "reversal-read", lambda _: None
        )
        effective = use.statement(pair[0])
        assert effective.items == [] and effective.closingCredit == 0
        history = use.statement(pair[0], effectiveOnly=False, sourceDocumentId=str(cash))
        assert_schema(history.model_dump(mode="json"), "CreditStatement")
        assert [item.amountDelta for item in history.items] == [100, -100]
        assert all(not item.isEffective and item.balanceAfter == 0 for item in history.items)
        assert history.items[1].reversesEntryId == history.items[0].id
        assert history.openingCredit == history.closingCredit == 0
        assert use.lots(pair[0], availableOnly=True).items == []
        lot = use.lots(pair[0]).items[0]
        assert lot.balance == lot.available == 0 and lot.originReceiptId == str(cash)
