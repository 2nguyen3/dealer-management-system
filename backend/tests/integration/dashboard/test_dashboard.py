from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from threading import Event
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError, AuthError
from app.modules.dashboard.repository import DashboardRepository
from app.modules.stock_receipts.schemas import Reason
from app.modules.upfront_payments.service import UpfrontPaymentService
from tests.integration.catalogues.helpers import (
    agency,
    draft,
    install_builders,
    post_stock,
    product,
)
from tests.integration.document_corrections.test_issues import replacement, token, use_case
from tests.integration.reports.test_oracles import cash_oracle, product_sales_oracle, sales_oracle
from tests.integration.settlement_core.helpers import commit, issue
from tests.support.contract import SOURCE, assert_schema
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def grants(engine, allowed):
    with engine.begin() as connection:
        connection.execute(
            text("""UPDATE dms.group_permission p SET "isAllowed"=f.code=ANY(:codes)
                FROM dms.app_function f WHERE f.id=p."functionId" AND p."groupId"=1"""),
            {"codes": list(allowed)},
        )


def read(dashboard, month="2026-01"):
    result = dashboard.service.get(dashboard.token, month).model_dump(mode="json")
    assert_schema(result, "DashboardResponse")
    return result


def test_real_auth_single_grants_combinations_and_calendar(engine, trading, dashboard):
    policy = {
        "agency.read": "agencies",
        "inventory.read": "inventory",
        "sales.read": "sales",
        "debt.read": "receivables",
        "stock.issue.post": "pendingIssueCount",
        "cash.upfront.verify": "verifiedUnreceiptedAmount",
    }
    assert set(policy) == set(SOURCE["paths"]["/dashboard"]["get"]["x-permissions"]["anyOf"])
    for grant, key in policy.items():
        grants(engine, [grant])
        assert set(read(dashboard)) == {"month", "asOf", key}
    for allowed in ([], ["stock.issue.prepare"], ["cash.receipt.post"], ["reports.read"]):
        grants(engine, allowed)
        with pytest.raises(AuthError) as error:
            read(dashboard)
        assert error.value.status == 403
    grants(engine, ["agency.read", "stock.issue.prepare", "cash.receipt.post"])
    assert set(read(dashboard)) == {
        "month",
        "asOf",
        "agencies",
        "pendingIssueCount",
        "verifiedUnreceiptedAmount",
    }
    with pytest.raises(ApiError) as error:
        read(dashboard, "0000-01")
    assert error.value.status == 422
    grants(engine, policy)
    last = read(dashboard, "9999-12")
    assert len(last["sales"]["monthlyTrend"]) == 12
    assert last["sales"]["monthlyTrend"][-1]["month"] == "9999-12"
    assert last["sales"]["gross"] == last["receivables"]["cashReceived"] == "0"
    assert last["inventory"]["receivedAmount"] == last["verifiedUnreceiptedAmount"] == "0"
    first = read(dashboard, "0001-01")
    assert [point["month"] for point in first["sales"]["monthlyTrend"]] == ["0001-01"]


def test_independent_current_period_oracles_and_twelve_tied_rankings(
    engine, actor, report_scenario, dashboard
):
    with Session(engine) as session:
        install_builders(session, actor)
        session.execute(text('UPDATE dms.business_rule SET "maxAgenciesPerDistrict"=100 WHERE id'))
        unit = session.scalar(text("SELECT id FROM dms.unit WHERE code='PCS'"))
        tied_products, tied_agencies = [], []
        for _ in range(12):
            agency_id, product_id = agency(session), product(session, unit)
            post_stock(session, draft(session, product_id, quantity="100"))
            issue(session, actor, (agency_id, product_id), quantity=10)
            tied_products.append(product_id)
            tied_agencies.append(agency_id)
        commit(session)
    january, february = read(dashboard), read(dashboard, "2026-02")
    with engine.connect() as connection:
        for month, response, start, end in (
            ("2026-01", january, date(2026, 1, 1), date(2026, 2, 1)),
            ("2026-02", february, date(2026, 2, 1), date(2026, 3, 1)),
        ):
            expected = sales_oracle(connection, start, end)["totals"]
            assert Decimal(response["sales"]["gross"]) == expected["salesAmount"]
            assert Decimal(response["sales"]["returns"]) == expected["returnAmount"]
            assert Decimal(response["sales"]["net"]) == expected["netSalesAmount"]
            assert response["sales"]["monthlyTrend"][-1] == dict(
                month=month, **{key: response["sales"][key] for key in ("gross", "returns", "net")}
            )
            cash = cash_oracle(connection, start, end)
            for key, kind in (("cashReceived", "PAYMENT_RECEIPT"), ("cashRefunded", "REFUND")):
                assert Decimal(response["receivables"][key]) == sum(
                    (row["amount"] for row in cash["cash"] if row["kind"] == kind), Decimal(0)
                )
            products = product_sales_oracle(connection, start, end)["rows"]
            products.sort(key=lambda row: (-row["salesAmount"], row["productId"]))
            assert [int(row["productId"]) for row in response["sales"]["topProducts"]] == [
                row["productId"] for row in products[:10]
            ]
            for actual, expected_row in zip(
                response["sales"]["topProducts"], products, strict=False
            ):
                for field in (
                    "soldQuantity",
                    "returnedQuantity",
                    "salesAmount",
                    "returnAmount",
                    "netSalesAmount",
                ):
                    assert Decimal(actual[field]) == expected_row[field]
            for key, table in (
                ("currentDebt", "receivable_entry"),
                ("currentCredit", "credit_entry"),
            ):
                assert Decimal(response["receivables"][key]) == connection.scalar(
                    text(f"SELECT coalesce(sum(amount),0) FROM dms.{table}")
                )
            assert response["inventory"]["productCount"] == connection.scalar(
                text("SELECT count(*) FROM dms.product")
            )
            assert response["agencies"]["total"] == connection.scalar(
                text("SELECT count(*) FROM dms.agency")
            )
            assert response["agencies"]["active"] == connection.scalar(
                text("SELECT count(*) FROM dms.agency WHERE status='ACTIVE'")
            )
            assert response["inventory"]["lowStockProductCount"] == connection.scalar(
                text("""
                SELECT count(*) FROM dms.product p
                JOIN dms.inventory_balance b ON b."productId"=p.id
                WHERE b."currentStock"<p."lowStockThreshold"
            """)
            )
            assert Decimal(response["inventory"]["receivedAmount"]) == connection.scalar(
                text("""
                SELECT coalesce(sum(r."totalAmount"),0) FROM dms.document d
                JOIN dms.document_revision r ON r.id=d."currentRevisionId"
                WHERE d.kind='STOCK_RECEIPT' AND d.status='POSTED'
                AND r."businessDate">=:start AND r."businessDate"<:end
            """),
                {"start": start, "end": end},
            )
        assert [int(row["productId"]) for row in january["sales"]["topProducts"]] == tied_products[
            :10
        ]
        assert [
            int(row["agencyId"]) for row in january["receivables"]["topAgencies"]
        ] == tied_agencies[:10]
        assert january["receivables"]["currentDebt"] == february["receivables"]["currentDebt"]
        assert january["sales"]["gross"] != february["sales"]["gross"]
        assert (
            connection.scalar(
                text(
                    "SELECT coalesce(sum(amount),0) FROM dms.refund_reservation "
                    "WHERE state='ACTIVE'"
                )
            )
            == 50
        )


def test_verified_vietnam_period_separate_consume_and_retry_once(engine, actor, trading, dashboard):
    issues, confirmations = [], []
    with Session(engine) as session:
        install_builders(session, actor)
        for instant in (
            "2025-12-31T17:00:00+00:00",
            "2026-01-02T03:00:00+00:00",
            "2025-12-31T16:59:59+00:00",
            "2026-01-31T17:00:00+00:00",
        ):
            identifier = draft(
                session, trading[1], kind="STOCK_ISSUE", agency_id=trading[0], quantity="3"
            )
            session.execute(text("SELECT pg_temp.ready(:id,40)"), {"id": identifier})
            confirmation = session.scalar(
                text("""
                INSERT INTO dms.upfront_confirmation
                ("issueRevisionId",amount,method,"receivedAt","verifiedBy")
                SELECT "currentRevisionId",40,'CASH',CAST(:instant AS timestamptz),:actor
                FROM dms.document WHERE id=:id RETURNING id
            """),
                {"instant": instant, "actor": actor, "id": identifier},
            )
            issues.append(identifier)
            confirmations.append(confirmation)
        commit(session)
    before = read(dashboard)
    assert before["verifiedUnreceiptedAmount"] == "80" and before["pendingIssueCount"] == 4
    assert before["receivables"]["cashReceived"] == "0"
    with Session(engine) as session:
        owner = UpfrontPaymentService(
            session, CursorCodec(b"x" * 32), actor, "m31-money", lambda _: None
        )
        condition = Preconditions(owner.etag(owner.get(confirmations[0])))
        key = uuid4()
        separated = owner.separate(
            confirmations[0], Reason(reason="Delivery pending"), condition, key
        )
        assert (
            owner.separate(confirmations[0], Reason(reason="Delivery pending"), condition, key)
            == separated
        )
    middle = read(dashboard)
    assert middle["verifiedUnreceiptedAmount"] == middle["receivables"]["cashReceived"] == "40"
    with Session(engine) as session:
        owner = use_case(session, actor).owner
        condition, key = token(engine, actor, issues[1]), uuid4()
        posted = owner.post(issues[1], condition, key)
        assert owner.post(issues[1], condition, key) == posted
    final = read(dashboard)
    assert final["verifiedUnreceiptedAmount"] == "0"
    assert final["receivables"]["cashReceived"] == "80" and final["pendingIssueCount"] == 3
    assert read(dashboard, "2026-02")["verifiedUnreceiptedAmount"] == "40"
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM dms.document "
                    "WHERE kind='PAYMENT_RECEIPT' AND status='POSTED'"
                )
            )
            == 2
        )
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM dms.upfront_confirmation "
                    "WHERE state='VERIFIED' AND \"receiptDocumentId\" IS NULL"
                )
            )
            == 2
        )


def test_readonly_snapshot_vs_committed_correction_and_grant_revocation(
    engine, actor, trading, dashboard, monkeypatch
):
    with Session(engine) as session:
        identifier = issue(session, actor, trading, quantity=3)
        commit(session)
    before = read(dashboard)
    observed, release = Event(), Event()
    original = DashboardRepository.agencies
    reader_pids = []

    def paused(repository):
        session = repository.session
        assert session.scalar(text("SHOW transaction_isolation")) == "repeatable read"
        assert session.scalar(text("SHOW transaction_read_only")) == "on"
        reader_pids.append(session.scalar(text("SELECT pg_backend_pid()")))
        # SAVEPOINT rollback must recover the real read transaction after SQLSTATE 25006.
        with pytest.raises(DBAPIError) as error, session.begin_nested():
            session.execute(
                text("UPDATE dms.agency SET name='forbidden' WHERE id=:id"), {"id": trading[0]}
            )
        assert error.value.orig.sqlstate == "25006"
        result = original(repository)
        observed.set()
        assert release.wait(race_timeout(20)), "Writer never released snapshot reader"
        return result

    monkeypatch.setattr(DashboardRepository, "agencies", paused)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(read, dashboard)
        try:
            assert observed.wait(race_timeout(20)), "Reader never reached live snapshot"
            with Session(engine) as session:
                assert session.scalar(text("SELECT pg_backend_pid()")) != reader_pids[0]
                owner = use_case(session, actor)
                owner.correct(
                    identifier,
                    replacement(trading[1], "2", businessDate="2026-02-02"),
                    token(engine, actor, identifier),
                    uuid4(),
                )
            grants(engine, ["agency.read", "inventory.read", "debt.read"])
        finally:
            release.set()
        during = future.result(timeout=race_timeout(20))
    monkeypatch.setattr(DashboardRepository, "agencies", original)
    assert {key: value for key, value in during.items() if key != "asOf"} == {
        key: value for key, value in before.items() if key != "asOf"
    }
    assert during["asOf"] >= before["asOf"]
    after = read(dashboard)
    assert set(after) == {"month", "asOf", "agencies", "inventory", "receivables"}
    assert after["receivables"]["currentDebt"] == "204"
    assert before["receivables"]["currentDebt"] == "306"
    grants(engine, [])
    with pytest.raises(AuthError) as error:
        read(dashboard)
    assert error.value.status == 403
    with engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT name FROM dms.agency WHERE id=:id"), {"id": trading[0]})
            == "Agency"
        )
        assert connection.scalar(text("SHOW transaction_read_only")) == "off"
