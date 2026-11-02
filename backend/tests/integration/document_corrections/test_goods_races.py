from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from unittest.mock import Mock
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import AuthError
from app.modules.auth.service import AuthService
from app.modules.stock_adjustments.service import StockAdjustmentService
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.document_corrections.helpers import condition, replacement, service, snapshot
from tests.integration.documents.test_receipts import post_receipt, receipt
from tests.integration.stock_adjustments.test_adjustments import create as adjustment
from tests.integration.user_groups.test_group_concurrency import wait_for_blocker
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("leading", ["correction", "post"])
def test_receipt_reduction_vs_stock_consumption_observes_both_lock_winners(
    client, engine, actor, product, leading
):
    incoming = receipt(client, product, quantity="10")
    assert post_receipt(client, incoming).status_code == 200
    outgoing = adjustment(client, product["id"], "-8", "2026-10-02")
    identifier = int(incoming.json()["id"])
    token = condition(client, incoming.headers["Location"])

    def correct(session):
        return service(session, actor).correct(
            identifier, replacement(product["id"], quantity="5"), token, uuid4()
        )

    def post(session):
        return StockAdjustmentService(
            session, service(session, actor).owner.codec, actor, "m29-opponent", lambda _: None
        ).post(int(outgoing.json()["id"]), Preconditions(outgoing.headers["ETag"]), uuid4())

    first, second = ordered_race(
        engine,
        correct if leading == "correction" else post,
        post if leading == "correction" else correct,
    )
    assert first.body["status"] == "POSTED" and second == "STOCK_CONFLICT"
    persisted = snapshot(engine)
    assert persisted["inventory_balance"][0]["currentStock"] == (
        5 if leading == "correction" else 2
    )
    assert len(persisted["document_revision"]) == (3 if leading == "correction" else 2)


def test_same_correction_key_has_one_successor_and_changed_product_race_rediscovers(
    client, engine, actor, product
):
    incoming = receipt(client, product, quantity="10")
    assert post_receipt(client, incoming).status_code == 200
    identifier = int(incoming.json()["id"])
    path = incoming.headers["Location"]
    token, key = condition(client, path), uuid4()
    body = replacement(product["id"])
    first, second = ordered_race(
        engine,
        lambda session: service(session, actor).correct(identifier, body, token, key),
        lambda session: service(session, actor).correct(identifier, body, token, key),
    )
    assert first == second
    assert len(snapshot(engine)["document_revision"]) == 2
    other = client.post(
        "/api/v1/products", json={"name": "Other", "unitId": product["unitId"]}
    ).json()
    token = Preconditions(first.headers["ETag"])
    first, second = ordered_race(
        engine,
        lambda session: service(session, actor).correct(
            identifier, replacement(other["id"]), token, uuid4()
        ),
        lambda session: service(session, actor).correct(identifier, body, token, uuid4()),
    )
    assert first.body["revisionNo"] == 3 and second == "PRECONDITION_FAILED"
    persisted = snapshot(engine)
    assert len(persisted["document_revision"]) == 3
    assert [row["currentStock"] for row in persisted["inventory_balance"]] == [0, 3]


def test_grant_revocation_during_observed_product_wait_rolls_back_correction(
    client, engine, actor, product
):
    incoming = receipt(client, product, quantity="10")
    assert post_receipt(client, incoming).status_code == 200
    identifier = int(incoming.json()["id"])
    token = condition(client, incoming.headers["Location"])
    raw = client.headers["Authorization"].removeprefix("Bearer ")
    waiting = Queue()

    def correct():
        with Session(engine) as session:
            waiting.put(session.scalar(text("SELECT pg_backend_pid()")))
            auth = AuthService(session, client.app.state.settings, Mock())
            principal = auth.authenticate(raw)

            def authorize(required):
                if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                    raise AuthError(403, "FORBIDDEN", "Denied")

            try:
                return service(session, actor, authorize=authorize).correct(
                    identifier, replacement(product["id"]), token, uuid4()
                )
            except AuthError as error:
                return error.code

    with Session(engine) as blocker, ThreadPoolExecutor(1) as pool:
        blocker.execute(
            text("SELECT id FROM dms.product WHERE id=:id FOR UPDATE"), {"id": int(product["id"])}
        )
        future = pool.submit(correct)
        try:
            wait_for_blocker(engine, waiting.get(timeout=race_timeout(10)))
            with engine.begin() as connection:
                connection.execute(
                    text("""
                    UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1
                    AND "functionId"=(SELECT id FROM dms.app_function
                      WHERE code='documents.correct')
                    """)
                )
            before = snapshot(engine)
        finally:
            blocker.rollback()
        assert future.result(timeout=race_timeout(20)) == "FORBIDDEN"
    assert snapshot(engine) == before
