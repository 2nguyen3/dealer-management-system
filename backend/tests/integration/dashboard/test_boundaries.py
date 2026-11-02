from concurrent.futures import ThreadPoolExecutor
from threading import Event
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.dashboard.repository import DashboardRepository
from app.modules.stock_receipts.schemas import Reason
from app.modules.upfront_payments.service import UpfrontPaymentService
from tests.integration.catalogues.helpers import draft, install_builders
from tests.integration.dashboard.test_dashboard import read
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.settlement_core.helpers import commit
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def test_empty_dashboard_is_readonly_and_allows_zero_sections(engine, dashboard):
    before = snapshot(engine)
    result = read(dashboard)
    assert result["agencies"] == {"total": 0, "active": 0}
    assert result["inventory"] == {
        "productCount": 0,
        "lowStockProductCount": 0,
        "receivedAmount": "0",
    }
    assert result["pendingIssueCount"] == 0 and result["verifiedUnreceiptedAmount"] == "0"
    assert result["sales"]["topProducts"] == result["receivables"]["topAgencies"] == []
    assert len(result["sales"]["monthlyTrend"]) == 12
    assert all(
        point[key] == "0"
        for point in result["sales"]["monthlyTrend"]
        for key in ("gross", "returns", "net")
    )
    assert snapshot(engine) == before
    assert engine.pool.checkedout() == 0


def test_current_master_thresholds_and_queue_ignore_selected_month(engine, trading, dashboard):
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE dms.product SET status='INACTIVE',\"lowStockThreshold\"=1000 WHERE id=:id"
            ),
            {"id": trading[1]},
        )
    equal = read(dashboard)
    assert equal["inventory"]["productCount"] == 1
    assert equal["inventory"]["lowStockProductCount"] == 0
    with engine.begin() as connection:
        connection.execute(
            text('UPDATE dms.product SET "lowStockThreshold"=1001 WHERE id=:id'),
            {"id": trading[1]},
        )
    january, future = read(dashboard), read(dashboard, "2027-01")
    assert (
        january["inventory"]["lowStockProductCount"]
        == future["inventory"]["lowStockProductCount"]
        == 1
    )
    assert january["inventory"]["receivedAmount"] == "100000"
    assert future["inventory"]["receivedAmount"] == "0"
    with engine.begin() as connection:
        connection.execute(
            text('UPDATE dms.product SET "lowStockThreshold"=0 WHERE id=:id'),
            {"id": trading[1]},
        )
    assert read(dashboard)["inventory"]["lowStockProductCount"] == 0


def test_receipt_evidence_transition_is_one_repeatable_read_observation(
    engine, actor, trading, dashboard, monkeypatch
):
    with Session(engine) as session:
        install_builders(session, actor)
        identifier = draft(
            session, trading[1], kind="STOCK_ISSUE", agency_id=trading[0], quantity="3"
        )
        session.execute(text("SELECT pg_temp.ready(:id,40)"), {"id": identifier})
        confirmation = session.scalar(
            text("""INSERT INTO dms.upfront_confirmation
                ("issueRevisionId",amount,method,"receivedAt","verifiedBy")
                SELECT "currentRevisionId",40,'CASH',TIMESTAMPTZ '2026-01-02 03:00:00Z',:actor
                FROM dms.document WHERE id=:id RETURNING id"""),
            {"actor": actor, "id": identifier},
        )
        commit(session)
    before = read(dashboard)
    observed, release = Event(), Event()
    original = DashboardRepository.receivables

    def paused(repository, bounds):
        result = original(repository, bounds)
        observed.set()
        assert release.wait(race_timeout(20))
        return result

    monkeypatch.setattr(DashboardRepository, "receivables", paused)
    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(read, dashboard)
        try:
            assert observed.wait(race_timeout(20))
            with Session(engine) as session:
                owner = UpfrontPaymentService(
                    session, CursorCodec(b"d" * 32), actor, "m31-concurrent-cash", lambda _: None
                )
                owner.separate(
                    confirmation,
                    Reason(reason="Receipt while dashboard reads"),
                    Preconditions(owner.etag(owner.get(confirmation))),
                    uuid4(),
                )
        finally:
            release.set()
        during = pending.result(timeout=race_timeout(20))
    monkeypatch.setattr(DashboardRepository, "receivables", original)
    assert {key: value for key, value in during.items() if key != "asOf"} == {
        key: value for key, value in before.items() if key != "asOf"
    }
    after = read(dashboard)
    assert before["verifiedUnreceiptedAmount"] == "40"
    assert before["receivables"]["cashReceived"] == "0"
    assert after["verifiedUnreceiptedAmount"] == "0"
    assert after["receivables"]["cashReceived"] == "40"
