from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.sales_returns.schemas import SalesReturnCreate
from app.modules.sales_returns.service import SalesReturnService
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_two_returns_compete_for_remaining_original_quantity(engine, actor, trading):
    def service(session):
        return SalesReturnService(
            session, CursorCodec(b"x" * 32), actor, "return-race", lambda _: None
        )

    with Session(engine) as session:
        source = issue(
            session, actor, (int(trading["agency"]), int(trading["product"])), quantity=3
        )
        commit(session)
        use = service(session)
        origin = use.repo.origin(source)
        line = use.core.repo.lines(origin["currentRevisionId"])[0]
        body = SalesReturnCreate(
            originDocumentId=str(source),
            businessDate="2026-01-04",
            lines=[{"originLineId": str(line["id"]), "quantity": "2"}],
        )
        first = use.create(body, uuid4())
        second = use.create(body, uuid4())
    one, two = ordered_race(
        engine,
        lambda session: service(session).post(
            int(first.body["id"]), Preconditions(first.headers["ETag"]), uuid4()
        ),
        lambda session: service(session).post(
            int(second.body["id"]), Preconditions(second.headers["ETag"]), uuid4()
        ),
    )
    assert one.body["status"] == "POSTED" and two == "RETURN_QUANTITY_CONFLICT"
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 99
        assert connection.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 102
