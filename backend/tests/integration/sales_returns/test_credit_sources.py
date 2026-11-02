from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.request_context import set_audit_context
from app.modules.agency_credit.service import AgencyCreditService
from app.modules.sales_returns.schemas import SalesReturnCreate
from app.modules.sales_returns.service import SalesReturnService
from tests.integration.settlement_core.helpers import commit, financial, issue, mark_posted, service
from tests.integration.settlement_core.test_reservations import credit_cash

pytestmark = pytest.mark.integration


def test_credit_funded_sale_return_restores_original_cash_source_without_new_cash(
    engine, actor, trading
):
    pair = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        cash, _ = credit_cash(session, actor, pair, 200)
        commit(session)
        sale = issue(session, actor, pair, day=4)
        application = financial(
            session,
            actor,
            pair[0],
            102,
            day=5,
            kind="CREDIT_APPLICATION",
            receipt=None,
            method=None,
        )
        mark_posted(session, actor, application)
        service(session, actor).replay(pair[0], uuid4(), permission="credit.apply")
        commit(session)
        set_audit_context(session, actor, "historical-product", function_code="product.manage")
        session.execute(
            text("UPDATE dms.product SET status='INACTIVE',name='Renamed product' WHERE id=:id"),
            {"id": pair[1]},
        )
        set_audit_context(session, actor, "historical-unit", function_code="unit.manage")
        session.execute(
            text("UPDATE dms.unit SET status='INACTIVE',name='Renamed unit' WHERE id=:id"),
            {"id": trading["unit"]},
        )
        set_audit_context(session, actor, "historical-agency", function_code="agency.manage")
        session.execute(
            text("""UPDATE dms.agency SET status='TERMINATED',"terminatedAt"=clock_timestamp(),
              "terminationReason"='Historical source closure' WHERE id=:id"""),
            {"id": pair[0]},
        )
        commit(session)
        use = SalesReturnService(
            session, CursorCodec(b"x" * 32), actor, "credit-source-return", lambda _: None
        )
        origin = use.repo.origin(sale)
        line = use.core.repo.lines(origin["currentRevisionId"])[0]
        draft = use.create(
            SalesReturnCreate(
                originDocumentId=str(sale),
                businessDate="2026-01-06",
                lines=[{"originLineId": str(line["id"]), "quantity": "1"}],
            ),
            uuid4(),
        )
        posted = use.post(int(draft.body["id"]), Preconditions(draft.headers["ETag"]), uuid4())
        assert posted.body["agencyBalance"]["currentDebt"] == "0"
        assert posted.body["agencyBalance"]["currentCredit"] == "200"
        returned_line = use.get(int(draft.body["id"])).currentRevision.lines[0]
        assert (
            returned_line.productName == line["productName"]
            and returned_line.unitName == line["unitName"]
        )
        assert returned_line.unitPrice == line["unitPrice"]
        assert posted.body["inventoryChanges"][0]["currentStock"] == "100"
        credit = AgencyCreditService(session, use.codec, actor, "credit-chain-read", lambda _: None)
        lots = credit.lots(pair[0]).items
        assert len(lots) == 2 and {lot.originReceiptId for lot in lots} == {str(cash)}
        assert sorted(lot.balance for lot in lots) == [98, 102]
        statement = credit.statement(pair[0])
        assert [item.kind for item in statement.items] == ["CREATED", "OFFSET", "CREATED"]
        assert [item.balanceAfter for item in statement.items] == [200, 98, 200]
        assert (
            session.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'"))
            == 1
        )
        assert session.scalar(text("SELECT count(*) FROM dms.document WHERE kind='REFUND'")) == 0
