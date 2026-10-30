from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.modules.stock_issues.schemas import PendingIssueRevision
from tests.integration.catalogues.helpers import draft, install_builders
from tests.integration.dashboard.test_dashboard import read
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.test_issues import token, use_case
from tests.integration.settlement_core.helpers import commit

pytestmark = pytest.mark.integration


def test_historical_verified_money_is_not_limited_to_current_issue_revision(
    engine, actor, trading, dashboard
):
    with Session(engine) as session:
        install_builders(session, actor)
        identifier = draft(
            session, trading[1], kind="STOCK_ISSUE", agency_id=trading[0], quantity="3"
        )
        session.execute(text("SELECT pg_temp.ready(:id,40)"), {"id": identifier})
        old_revision = session.scalar(
            text('SELECT "currentRevisionId" FROM dms.document WHERE id=:id'), {"id": identifier}
        )
        commit(session)
    # Replace before money exists; public VERIFIED-money replacement guards stay intact.
    with Session(engine) as session:
        owner = use_case(session, actor).owner
        revised = owner.replace_pending(
            identifier,
            PendingIssueRevision(
                businessDate="2026-01-03",
                reason="Historical predecessor fixture",
                immediatePayment="0",
                lines=[{"productId": str(trading[1]), "quantity": "3"}],
            ),
            token(engine, actor, identifier),
            uuid4(),
        )
        owner.submit(identifier, Preconditions(revised.headers["ETag"]), uuid4())
    # Valid immutable legacy evidence is backfilled on its frozen historical READY row.
    # Every ordinary FK/deferred/domain guard runs; no public revision guard is bypassed.
    with Session(engine) as session:
        session.execute(
            text("""INSERT INTO dms.upfront_confirmation
                ("issueRevisionId",amount,method,"receivedAt","verifiedBy")
                VALUES (:revision,40,'CASH',TIMESTAMPTZ '2026-01-02 03:00:00Z',:actor)"""),
            {"revision": old_revision, "actor": actor},
        )
        commit(session)
        assert (
            session.scalar(
                text('SELECT "currentRevisionId" FROM dms.document WHERE id=:id'),
                {"id": identifier},
            )
            != old_revision
        )
    before = snapshot(engine)
    assert read(dashboard)["verifiedUnreceiptedAmount"] == "40"
    assert read(dashboard, "2026-02")["verifiedUnreceiptedAmount"] == "0"
    assert snapshot(engine) == before


def test_failed_post_rolls_back_then_cross_month_consume_and_retry_exactly_once(
    engine, actor, trading, dashboard
):
    with Session(engine) as session:
        install_builders(session, actor)
        identifier = draft(
            session,
            trading[1],
            kind="STOCK_ISSUE",
            agency_id=trading[0],
            quantity="3",
        )
        session.execute(
            text("""UPDATE dms.document_revision SET "businessDate"=DATE '2026-02-02'
                WHERE id=(SELECT "currentRevisionId" FROM dms.document WHERE id=:id)"""),
            {"id": identifier},
        )
        session.execute(text("SELECT pg_temp.ready(:id,40)"), {"id": identifier})
        session.execute(
            text("""INSERT INTO dms.upfront_confirmation
            ("issueRevisionId",amount,method,"receivedAt","verifiedBy")
            SELECT "currentRevisionId",40,'CASH',TIMESTAMPTZ '2026-01-02 03:00:00Z',:actor
            FROM dms.document WHERE id=:id"""),
            {"actor": actor, "id": identifier},
        )
        commit(session)
    before = snapshot(engine)
    january, february = read(dashboard), read(dashboard, "2026-02")
    with Session(engine) as session:
        owner = use_case(session, actor).owner
        condition = token(engine, actor, identifier)
        key = uuid4()
        with patch.object(session, "commit", side_effect=RuntimeError("injected commit failure")):
            with pytest.raises(RuntimeError):
                owner.post(identifier, condition, key)
    assert snapshot(engine) == before
    for month, previous in (("2026-01", january), ("2026-02", february)):
        assert {k: v for k, v in read(dashboard, month).items() if k != "asOf"} == {
            k: v for k, v in previous.items() if k != "asOf"
        }
    with Session(engine) as session:
        owner = use_case(session, actor).owner
        first = owner.post(identifier, condition, key)
        second = owner.post(identifier, condition, key)
        assert first.body == second.body
    january_after, february_after = read(dashboard), read(dashboard, "2026-02")
    assert january["verifiedUnreceiptedAmount"] == "40"
    assert january_after["verifiedUnreceiptedAmount"] == "0"
    assert january_after["receivables"]["cashReceived"] == "0"
    assert february_after["receivables"]["cashReceived"] == "40"
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("""SELECT count(*) FROM dms.document
            WHERE "originDocumentId"=:id AND "receiptType"='AUTO_FROM_ISSUE' """),
                {"id": identifier},
            )
            == 1
        )
