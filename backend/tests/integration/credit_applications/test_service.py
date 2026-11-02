from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.credit_applications.schemas import CreditApplicationCreate, CreditApplicationUpdate
from app.modules.credit_applications.service import CreditApplicationService
from app.modules.settlement_core.service import SettlementService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.settlement_core.helpers import commit, issue
from tests.integration.settlement_core.test_reservations import credit_cash

pytestmark = pytest.mark.integration


def service(session, actor):
    return CreditApplicationService(
        session, CursorCodec(b"x" * 32), actor, "m25-test", lambda _: None
    )


def create(use, agency, amount="100", day="2026-01-05", key=None):
    return use.create(
        CreditApplicationCreate(agencyId=str(agency), businessDate=day, amount=amount),
        key or uuid4(),
    )


def test_service_drafts_boundaries_rollback_and_cancel(engine, actor, trading):
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        credit_cash(session, actor, (agency, product), 100)
        issue(session, actor, (agency, product), day=4)
        commit(session)
        use = service(session, actor)
        created = create(use, agency)
        identifier = int(created.body["id"])
        condition = Preconditions(created.headers["ETag"])
        updated = use.update(
            identifier, CreditApplicationUpdate(note="Confirmed offset"), condition
        )
        assert updated.currentRevision.note == "Confirmed offset"
        with pytest.raises(ApiError, match="PRECONDITION_FAILED"):
            use.update(identifier, CreditApplicationUpdate(amount="99"), condition)
        condition = Preconditions(use.etag(use.get(identifier)))
        session.rollback()
        with patch.object(
            SettlementService, "replay", side_effect=ApiError(409, "INJECTED", "failure")
        ):
            with pytest.raises(ApiError, match="INJECTED"):
                use.post(identifier, condition, uuid4())
        with engine.connect() as check:
            assert (
                check.scalar(
                    text("SELECT status FROM dms.document WHERE id=:id"), {"id": identifier}
                )
                == "DRAFT"
            )
            assert (
                check.scalar(
                    text("""
                SELECT count(*) FROM dms.posting_batch b JOIN dms.document_revision r
                ON r.id=b."revisionId" WHERE r."documentId"=:id
            """),
                    {"id": identifier},
                )
                == 0
            )
            assert (
                check.scalar(text("SELECT count(*) FROM dms.credit_entry WHERE kind='OFFSET'")) == 0
            )
        assert use.get(identifier).status == "DRAFT"
        session.rollback()
        posted = use.post(identifier, condition, uuid4())
        assert posted.body["agencyBalance"]["currentDebt"] == "2"
        assert posted.body["agencyBalance"]["currentCredit"] == "0"
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            use.post(identifier, Preconditions(posted.headers["ETag"]), uuid4())
        cancelled = create(use, agency, "1")
        cancel_id = int(cancelled.body["id"])
        result = use.cancel_draft(
            cancel_id,
            Reason(reason="No longer needed"),
            Preconditions(cancelled.headers["ETag"]),
            uuid4(),
        )
        assert result.body["status"] == "CANCELLED"
        with pytest.raises(ApiError, match="AGENCY_CONFLICT"):
            create(use, agency, day="2025-01-01")
        page = use.list(limit=1)
        assert page.pagination.hasMore
        assert use.list(limit=1, cursor=page.pagination.nextCursor).items[0].id != page.items[0].id
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'")
            )
            == 1
        )
        assert (
            connection.scalar(text("SELECT sum(amount) FROM dms.credit_entry WHERE kind='OFFSET'"))
            == -100
        )
