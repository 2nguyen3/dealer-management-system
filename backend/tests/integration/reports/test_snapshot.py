from concurrent.futures import ThreadPoolExecutor
from datetime import date
from threading import Event
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.modules.reports.repository import ReportQueries
from app.modules.reports.service import ReportService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.helpers import agency, install_builders
from tests.integration.document_corrections.test_issues import (
    ready_with_money,
    replacement,
    token,
    use_case,
)
from tests.integration.document_corrections.test_return_credit import match
from tests.integration.settlement_core.helpers import commit
from tests.integration.settlement_core.test_reservations import reservations
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def test_inflight_statement_keeps_snapshot_across_date_move_reservation_and_evidence(
    engine, actor, trading, report_scenario
):
    lock = uuid4().int % (2**63 - 1)
    with engine.begin() as connection:
        connection.execute(
            text("""
        CREATE FUNCTION dms.m30_snapshot_barrier(k bigint) RETURNS boolean
        LANGUAGE plpgsql VOLATILE AS $$ BEGIN
          RAISE NOTICE 'm30_snapshot_acquired';
          PERFORM pg_advisory_xact_lock(k); RETURN true;
        END $$
        """)
        )
    with Session(engine) as session:
        install_builders(session, actor)
        evidence_agency = agency(session)
        commit(session)
    evidence_issue = ready_with_money(engine, actor, (evidence_agency, trading[1]), posted=False)
    for transition in ("date-move", "reservation", "evidence"):
        started = Event()
        kind = "sales" if transition == "date-move" else "cash-and-credit"
        start, end = date(2026, 1, 1), date(2026, 3, 1)
        with Session(engine) as session:
            before = ReportService(session, CursorCodec(b"r" * 32)).read(kind, start, end)

        def reader(kind=kind, start=start, end=end, started=started):
            with Session(engine) as session:
                driver = session.connection().connection.driver_connection

                def notice_received(notice):
                    if notice.message_primary == "m30_snapshot_acquired":
                        started.set()

                driver.add_notice_handler(notice_received)
                try:
                    service = ReportService(session, CursorCodec(b"r" * 32))
                    statement = text(
                        "WITH barrier AS MATERIALIZED (SELECT dms.m30_snapshot_barrier(:gate)) "
                        "SELECT report.* FROM barrier CROSS JOIN ("
                        + str(ReportQueries.statement(kind))
                        + ") report"
                    ).bindparams(gate=lock)
                    with patch.object(service.queries, "statement", return_value=statement):
                        return service.read(kind, start, end)
                finally:
                    driver.remove_notice_handler(notice_received)

        with Session(engine) as writer, ThreadPoolExecutor(1) as pool:
            writer.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
            future = pool.submit(reader)
            try:
                assert started.wait(race_timeout(15)), "Server statement barrier not observed"
                correction = use_case(writer, actor)
                if transition == "date-move":
                    identifier = report_scenario["corrected_issue"]
                    correction.correct(
                        identifier,
                        replacement(report_scenario["products"][0], "1", businessDate="2026-03-02"),
                        match(correction.owner, identifier),
                        uuid4(),
                    )
                elif transition == "reservation":
                    reservations(writer, actor).release(report_scenario["reserved_refund"])
                    commit(writer)
                else:
                    correction.cancel(
                        evidence_issue,
                        Reason(reason="Separate verified evidence"),
                        match(correction.owner, evidence_issue),
                        uuid4(),
                    )
            finally:
                writer.rollback()
            concurrent = future.result(timeout=race_timeout(20))
        assert concurrent.items == before.items and concurrent.totals == before.totals
        with Session(engine) as session:
            after = ReportService(session, CursorCodec(b"r" * 32)).read(kind, start, end)
        if transition == "date-move":
            assert after.totals.salesAmount == before.totals.salesAmount - 204
        elif transition == "reservation":
            assert after.totals.closingCredit == before.totals.closingCredit
            assert after.totals.currentReservedCredit == before.totals.currentReservedCredit - 50
            assert after.totals.currentAvailableCredit == before.totals.currentAvailableCredit + 50
        else:
            assert after.totals.cashReceived == before.totals.cashReceived + 40
            assert (
                after.totals.verifiedUnreceiptedAmount
                == before.totals.verifiedUnreceiptedAmount - 40
            )


def test_report_rows_totals_and_denominator_share_snapshot_during_real_correction(
    engine, actor, report_scenario
):
    start, end = date(2026, 2, 1), date(2026, 3, 1)
    identifier = report_scenario["corrected_issue"]
    with Session(engine) as session:
        before = ReportService(session, CursorCodec(b"r" * 32)).read("sales", start, end)
    materialized, committed = Event(), Event()

    def reader():
        with Session(engine) as session:
            service = ReportService(session, CursorCodec(b"r" * 32))
            read = service.queries.read

            def pause_after_statement(*args, **kwargs):
                result = read(*args, **kwargs)
                materialized.set()
                assert committed.wait(race_timeout(30))
                return result

            with patch.object(service.queries, "read", side_effect=pause_after_statement):
                return service.read("sales", start, end)

    with ThreadPoolExecutor(1) as pool:
        future = pool.submit(reader)
        try:
            assert materialized.wait(race_timeout(15))
            with Session(engine) as session:
                use_case(session, actor).correct(
                    identifier,
                    replacement(report_scenario["products"][0], "1", businessDate="2026-02-02"),
                    token(engine, actor, identifier),
                    uuid4(),
                )
        finally:
            committed.set()
        concurrent = future.result(timeout=race_timeout(15))
    assert concurrent.items == before.items and concurrent.totals == before.totals
    with Session(engine) as session:
        after = ReportService(session, CursorCodec(b"r" * 32)).read("sales", start, end)
    assert after.totals.salesAmount == before.totals.salesAmount - 102
    assert concurrent.totals.companyGrossSales == before.totals.companyGrossSales
