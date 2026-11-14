"""Concurrent postings on real PostgreSQL never overdraw stock or exceed debt limits.

A third connection holds the contested row lock while both posts start, so both
transactions are really waiting at the same time before the lock is released.
"""

import threading
import time
from decimal import Decimal

import pytest
from sqlalchemy import text

from app.core.exceptions import ApiError
from tests.integration.documents.conftest import balances, match
from tests.integration.documents.test_document_service import issue_body, post_new, receipt_body

pytestmark = pytest.mark.integration


def race(engine, lock_sql, params, services_and_drafts):
    outcomes: list[str] = []
    guard = threading.Lock()

    def run(service, draft):
        try:
            service.post(int(draft.id), match(service, draft))
            result = "POSTED"
        except ApiError as error:
            result = error.code
        with guard:
            outcomes.append(result)

    with engine.connect() as blocker:
        transaction = blocker.begin()
        blocker.execute(text(lock_sql), params)
        threads = [threading.Thread(target=run, args=pair) for pair in services_and_drafts]
        for thread in threads:
            thread.start()
        time.sleep(1.0)  # both posts are now blocked on the held lock
        with engine.connect() as observer:
            waiting = observer.execute(
                text(
                    "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' "
                    "AND datname=current_database()"
                )
            ).scalar_one()
        transaction.rollback()
        for thread in threads:
            thread.join(30)
    return sorted(outcomes), waiting


def test_parallel_issues_of_one_product_never_overdraw_stock(documents, world, engine):
    post_new(documents("STOCK_RECEIPT"), receipt_body((world.noodles, 10, 1000)))
    pairs = []
    for agency in (world.agency, world.second_agency):
        service = documents("STOCK_ISSUE")
        pairs.append((service, service.create(issue_body(agency, (world.noodles, 6)))))
    outcomes, waiting = race(
        engine, "SELECT 1 FROM dms.product WHERE id=:id FOR UPDATE", {"id": world.noodles}, pairs
    )
    assert waiting >= 2
    assert outcomes == ["INSUFFICIENT_STOCK", "POSTED"]
    assert balances(engine, world)[0][world.noodles] == 4


def test_parallel_issues_of_one_agency_never_exceed_debt_limit(documents, world, engine):
    post_new(documents("STOCK_RECEIPT"), receipt_body((world.noodles, 200, 50000)))
    pairs = []
    for _ in range(2):
        service = documents("STOCK_ISSUE")
        # 100 × 51,000 = 5,100,000 each; both together exceed 10,000,000.
        pairs.append((service, service.create(issue_body(world.agency, (world.noodles, 100)))))
    outcomes, waiting = race(
        engine, "SELECT 1 FROM dms.agency WHERE id=:id FOR UPDATE", {"id": world.agency}, pairs
    )
    assert waiting >= 2
    assert outcomes == ["DEBT_LIMIT_EXCEEDED", "POSTED"]
    stock, debt, _ = balances(engine, world)
    assert debt[world.agency] == Decimal(5_100_000) and stock[world.noodles] == 100


def test_same_draft_posted_twice_concurrently_posts_once(documents, world, engine):
    post_new(documents("STOCK_RECEIPT"), receipt_body((world.noodles, 10, 1000)))
    first = documents("STOCK_ISSUE")
    draft = first.create(issue_body(world.agency, (world.noodles, 3)))
    second = documents("STOCK_ISSUE")
    outcomes, _ = race(
        engine,
        "SELECT 1 FROM dms.document WHERE id=:id FOR UPDATE",
        {"id": int(draft.id)},
        [(first, draft), (second, draft)],
    )
    assert outcomes == ["POSTED", "STATE_CONFLICT"]
    assert balances(engine, world)[0][world.noodles] == 7
