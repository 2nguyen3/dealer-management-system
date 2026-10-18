import time
from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Event
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError, AuthError
from app.modules.payment_receipts.schemas import PaymentReceiptCreate
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.stock_issues.schemas import StockIssueCreate
from app.modules.stock_issues.service import StockIssueService
from app.modules.stock_receipts.schemas import Reason
from app.modules.upfront_payments.schemas import UpfrontCreate
from app.modules.upfront_payments.service import UpfrontPaymentService

pytestmark = pytest.mark.integration


def service(cls, session, actor):
    return cls(session, CursorCodec(b"x" * 32), actor, "workflow-race", lambda _: None)


def ready_issue(session, actor, trading, quantity="3", immediate="0"):
    issues = service(StockIssueService, session, actor)
    created = issues.create(
        StockIssueCreate(
            agencyId=trading["agency"],
            businessDate="2026-01-02",
            immediatePayment=immediate,
            lines=[{"productId": trading["product"], "quantity": quantity}],
        ),
        uuid4(),
    )
    return issues.submit(int(created.body["id"]), Preconditions(created.headers["ETag"]), uuid4())


def ordered_race(engine, leading, following):
    reached, release = Event(), Event()
    waiter = Queue()

    def run(work, first):
        with Session(engine) as session:
            commit = session.commit

            def held_commit():
                if first:
                    reached.set()
                    assert release.wait(120)
                commit()

            if not first:
                waiter.put(session.scalar(text("SELECT pg_backend_pid()")))
            try:
                with patch.object(session, "commit", side_effect=held_commit):
                    return work(session)
            except (ApiError, AuthError) as error:
                return error.code

    with ThreadPoolExecutor(2) as pool:
        first = pool.submit(run, leading, True)
        if not reached.wait(120):
            release.set()
            pytest.fail(f"Leading transaction did not reach commit: {first.result(timeout=5)}")
        second = pool.submit(run, following, False)
        try:
            pid = waiter.get(timeout=30)
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as observer:
                deadline = time.monotonic() + 30
                while time.monotonic() < deadline:
                    if observer.scalar(
                        text("SELECT cardinality(pg_blocking_pids(:pid))"), {"pid": pid}
                    ):
                        break
                    Event().wait(0.05)
                else:
                    pytest.fail("No real PostgreSQL blocking relationship observed")
        finally:
            release.set()
        return first.result(timeout=120), second.result(timeout=120)


@pytest.mark.parametrize("winner", ["post", "separate"])
def test_issue_post_versus_separation_records_exactly_one_receipt(engine, actor, trading, winner):
    with Session(engine) as session:
        ready = ready_issue(session, actor, trading, immediate="200")
        upfront = service(UpfrontPaymentService, session, actor)
        confirmed = upfront.verify(
            UpfrontCreate(
                issueRevisionId=ready.body["revisionId"],
                amount="200",
                method="CASH",
                receivedAt="2026-01-01T18:00:00Z",
            ),
            uuid4(),
        )
        issues = service(StockIssueService, session, actor)
        item = issues.get(int(ready.body["id"]))
        issue_tag = issues.etag(item)
        session.rollback()

    def post(session):
        return (
            service(StockIssueService, session, actor)
            .post(int(item.id), Preconditions(issue_tag), uuid4())
            .body["status"]
        )

    def separate(session):
        return (
            service(UpfrontPaymentService, session, actor)
            .separate(
                int(confirmed.body["id"]),
                Reason(reason="Unable to dispatch"),
                Preconditions(confirmed.headers["ETag"]),
                uuid4(),
            )
            .body["confirmation"]["state"]
        )

    actions = {"post": post, "separate": separate}
    first, second = ordered_race(
        engine, actions[winner], actions["separate" if winner == "post" else "post"]
    )
    assert first == ("POSTED" if winner == "post" else "RECEIVED_SEPARATELY")
    assert second in ("PRECONDITION_FAILED", "UPFRONT_REQUIRED", "UPFRONT_CONFLICT")
    with engine.connect() as c:
        assert c.scalar(text("SELECT count(*) FROM dms.document WHERE kind='PAYMENT_RECEIPT'")) == 1
        row = c.execute(text('SELECT "currentDebt","currentCredit" FROM dms.agency_balance')).one()
        assert tuple(row) == ((106, 0) if winner == "post" else (0, 200))


def test_competing_issues_cannot_oversell_and_same_key_create_is_single_intent(
    engine, actor, trading
):
    with Session(engine) as session:
        one = ready_issue(session, actor, trading, quantity="60")
        two = ready_issue(session, actor, trading, quantity="60")

    def post(session, result):
        return (
            service(StockIssueService, session, actor)
            .post(int(result.body["id"]), Preconditions(result.headers["ETag"]), uuid4())
            .body["status"]
        )

    first, second = ordered_race(engine, lambda s: post(s, one), lambda s: post(s, two))
    assert (first, second) == ("POSTED", "INSUFFICIENT_STOCK")
    with engine.connect() as c:
        assert c.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 40
    key = uuid4()
    body = StockIssueCreate(agencyId=trading["agency"], businessDate="2026-01-03")

    def create(session):
        return service(StockIssueService, session, actor).create(body, key).body

    first, second = ordered_race(engine, create, create)
    assert first == second


def test_competing_manual_receipts_cannot_pay_same_debt_twice(engine, actor, trading):
    with Session(engine) as session:
        ready = ready_issue(session, actor, trading)
        service(StockIssueService, session, actor).post(
            int(ready.body["id"]), Preconditions(ready.headers["ETag"]), uuid4()
        )
        receipts = service(PaymentReceiptService, session, actor)
        body = PaymentReceiptCreate(
            agencyId=trading["agency"],
            businessDate="2026-01-03",
            amount="200",
            paymentMethod="CASH",
        )
        one, two = receipts.create(body, uuid4()), receipts.create(body, uuid4())

    def post(session, item):
        return (
            service(PaymentReceiptService, session, actor)
            .post(int(item.body["id"]), Preconditions(item.headers["ETag"]), uuid4())
            .body["status"]
        )

    first, second = ordered_race(engine, lambda s: post(s, one), lambda s: post(s, two))
    assert (first, second) == ("POSTED", "PAYMENT_EXCEEDS_DEBT")
    with engine.connect() as c:
        assert c.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 106
