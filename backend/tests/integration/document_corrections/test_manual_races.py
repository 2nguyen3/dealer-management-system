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
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.manual_helpers import (
    manual_body,
    manual_condition,
    manual_service,
)
from tests.integration.settlement_core.helpers import commit, financial, issue
from tests.integration.user_groups.test_group_concurrency import wait_for_blocker
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def prepare(engine, actor, trading):
    with Session(engine) as session:
        issue(session, actor, trading, quantity=3)
        commit(session)
        receipt = financial(session, actor, trading[0], 150)
        manual_service(session, actor).settlement.post_receipt(receipt, uuid4())
        commit(session)
        pending = financial(session, actor, trading[0], 150, day=4)
        commit(session)
    return receipt, pending


@pytest.mark.parametrize("leading", ["correction", "post"])
def test_manual_correction_and_later_receipt_post_both_lock_winners(
    engine, actor, trading, leading
):
    receipt, pending = prepare(engine, actor, trading)
    token = manual_condition(engine, actor, receipt)
    pending_token = manual_condition(engine, actor, pending)

    def correct(session):
        return manual_service(session, actor).correct(receipt, manual_body("200"), token, uuid4())

    def post(session):
        return manual_service(session, actor).owner.post(pending, pending_token, uuid4())

    first, second = ordered_race(
        engine,
        correct if leading == "correction" else post,
        post if leading == "correction" else correct,
    )
    assert first.body["status"] == "POSTED" and second == "PAYMENT_EXCEEDS_DEBT"
    with Session(engine) as session:
        source = manual_service(session, actor).settlement.repo.source(receipt)
        assert source["totalAmount"] == (200 if leading == "correction" else 150)
    assert snapshot(engine)["agency_balance"][0]["currentDebt"] == (
        106 if leading == "correction" else 6
    )


def test_same_manual_correction_key_commits_one_successor(engine, actor, trading):
    receipt, _ = prepare(engine, actor, trading)
    token, key = manual_condition(engine, actor, receipt), uuid4()
    first, second = ordered_race(
        engine,
        lambda session: manual_service(session, actor).correct(receipt, manual_body(), token, key),
        lambda session: manual_service(session, actor).correct(receipt, manual_body(), token, key),
    )
    assert first == second and first.body["revisionNo"] == 2
    assert len(snapshot(engine)["document_revision"]) == 5


def test_real_grants_cancel_only_and_completed_replay_are_reauthorized(
    client, engine, actor, trading
):
    receipt, _ = prepare(engine, actor, trading)
    token, key = manual_condition(engine, actor, receipt), uuid4()
    raw = client.headers["Authorization"].removeprefix("Bearer ")

    def grants(allowed):
        with engine.begin() as connection:
            connection.execute(
                text("""
                UPDATE dms.group_permission SET "isAllowed"=("functionId" IN (
                  SELECT id FROM dms.app_function WHERE code=ANY(:allowed))) WHERE "groupId"=1
                """),
                {"allowed": allowed},
            )

    def authorized(session):
        auth = AuthService(session, client.app.state.settings, Mock())
        principal = auth.authenticate(raw)

        def authorize(required):
            if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                raise AuthError(403, "FORBIDDEN", "Denied")

        return manual_service(session, actor, authorize)

    for allowed in (["documents.correct"], ["cash.receipt.post"], []):
        grants(allowed)
        before = snapshot(engine)
        with Session(engine) as session, pytest.raises(AuthError):
            authorized(session).correct(receipt, manual_body(), token, key)
        assert snapshot(engine) == before
    grants(["documents.correct", "cash.receipt.post"])
    with Session(engine) as session:
        result = authorized(session).correct(receipt, manual_body(), token, key)
    for allowed in (["documents.correct"], ["cash.receipt.post"]):
        grants(allowed)
        with Session(engine) as session, pytest.raises(AuthError):
            authorized(session).correct(receipt, manual_body(), token, key)
    grants(["documents.cancel"])
    key, token = uuid4(), Preconditions(result.headers["ETag"])
    with Session(engine) as session:
        canceled = authorized(session).cancel(receipt, Reason(reason="Wrong record"), token, key)
    with Session(engine) as session:
        assert (
            authorized(session).cancel(receipt, Reason(reason="Wrong record"), token, key)
            == canceled
        )
    grants([])
    with Session(engine) as session, pytest.raises(AuthError):
        authorized(session).cancel(receipt, Reason(reason="Wrong record"), token, key)


def test_manual_post_grant_revoked_during_observed_balance_wait_rolls_back(
    client, engine, actor, trading
):
    receipt, _ = prepare(engine, actor, trading)
    token = manual_condition(engine, actor, receipt)
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
                return manual_service(session, actor, authorize).correct(
                    receipt, manual_body(), token, uuid4()
                )
            except AuthError as error:
                return error.code

    with Session(engine) as blocker, ThreadPoolExecutor(1) as pool:
        blocker.execute(
            text('SELECT "agencyId" FROM dms.agency_balance WHERE "agencyId"=:id FOR UPDATE'),
            {"id": trading[0]},
        )
        future = pool.submit(correct)
        try:
            wait_for_blocker(engine, waiting.get(timeout=race_timeout(10)))
            with engine.begin() as connection:
                connection.execute(
                    text("""
                    UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1
                    AND "functionId"=(SELECT id FROM dms.app_function
                      WHERE code='cash.receipt.post')
                    """)
                )
            before = snapshot(engine)
        finally:
            blocker.rollback()
        assert future.result(timeout=race_timeout(20)) == "FORBIDDEN"
    assert snapshot(engine) == before
