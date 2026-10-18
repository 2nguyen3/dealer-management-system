from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.sales_returns.schemas import SalesReturnCreate
from app.modules.sales_returns.service import SalesReturnService
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_chronological_returns_do_not_replace_unchanged_frozen_content(engine, actor, trading):
    with Session(engine) as session:
        source = issue(
            session, actor, (int(trading["agency"]), int(trading["product"])), quantity=3
        )
        commit(session)
        use = SalesReturnService(
            session, CursorCodec(b"x" * 32), actor, "unchanged-return", lambda _: None
        )
        origin = use.repo.origin(source)
        line = use.core.repo.lines(origin["currentRevisionId"])[0]

        def return_one(day):
            draft = use.create(
                SalesReturnCreate(
                    originDocumentId=str(source),
                    businessDate=day,
                    lines=[{"originLineId": str(line["id"]), "quantity": "1"}],
                ),
                uuid4(),
            )
            return use.post(int(draft.body["id"]), Preconditions(draft.headers["ETag"]), uuid4())

        first = return_one("2026-01-04")
        original = use.get(int(first.body["id"])).currentRevision
        session.rollback()
        second = return_one("2026-01-05")
        assert second.body["agencyBalance"]["currentDebt"] == "102"
        assert second.body["inventoryChanges"][0]["currentStock"] == "99"
        assert use.get(int(first.body["id"])).currentRevision == original
