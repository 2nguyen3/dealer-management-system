from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError, AuthError
from app.modules.auth.service import AuthService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.helpers import install_builders, product
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.manual_helpers import manual_condition, manual_service
from tests.integration.document_corrections.test_issues import (
    ready_with_money,
    replacement,
    token,
    use_case,
)
from tests.integration.settlement_core.helpers import commit, financial, issue
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("leading", ["correction", "receipt"])
def test_issue_correction_and_cash_post_observe_both_lock_winners(engine, actor, trading, leading):
    with Session(engine) as session:
        identifier = issue(session, actor, trading, quantity=3)
        receipt = financial(session, actor, trading[0], 250, day=4)
        commit(session)
    condition = token(engine, actor, identifier)
    receipt_condition = manual_condition(engine, actor, receipt)

    def correct(session):
        return use_case(session, actor).correct(
            identifier, replacement(trading[1], "2"), condition, uuid4()
        )

    def post(session):
        return manual_service(session, actor).owner.post(receipt, receipt_condition, uuid4())

    first, second = ordered_race(
        engine,
        correct if leading == "correction" else post,
        post if leading == "correction" else correct,
    )
    assert first.body["status"] == "POSTED"
    assert second == ("PAYMENT_EXCEEDS_DEBT" if leading == "correction" else "PRECONDITION_FAILED")
    after = snapshot(engine)
    assert after["agency_balance"][0]["currentDebt"] == (204 if leading == "correction" else 56)
    assert len(after["document_revision"]) == (4 if leading == "correction" else 3)
    if leading == "receipt":
        with Session(engine) as session, pytest.raises(ApiError, match="PAYMENT_EXCEEDS_DEBT"):
            use_case(session, actor).correct(
                identifier,
                replacement(trading[1], "2"),
                token(engine, actor, identifier),
                uuid4(),
            )
        assert snapshot(engine) == after


def test_same_issue_correction_key_commits_one_successor(engine, actor, trading):
    with Session(engine) as session:
        identifier = issue(session, actor, trading, quantity=3)
        commit(session)
    condition, key = token(engine, actor, identifier), uuid4()
    before = snapshot(engine)

    def correct(session):
        return use_case(session, actor).correct(
            identifier, replacement(trading[1], "2"), condition, key
        )

    first, second = ordered_race(engine, correct, correct)
    assert first == second and first.body["revisionNo"] == 2
    after = snapshot(engine)
    assert len(after["document_revision"]) == len(before["document_revision"]) + 1
    assert len(after["api_idempotency"]) == len(before["api_idempotency"]) + 1
    with Session(engine) as session:
        install_builders(session, actor)
        unit = session.scalar(
            text('SELECT "unitId" FROM dms.product WHERE id=:id'), {"id": trading[1]}
        )
        other = product(session, unit)
        opening = session.scalar(
            text("""SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-01',
            jsonb_build_array(jsonb_build_object('product',CAST(:id AS bigint),
            'quantity',100,'price',100)),gen_random_uuid())"""),
            {"id": other},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": opening})
        commit(session)
    latest = token(engine, actor, identifier)
    moved, stale = ordered_race(
        engine,
        lambda session: use_case(session, actor).correct(
            identifier, replacement(other, "2"), latest, uuid4()
        ),
        lambda session: use_case(session, actor).correct(
            identifier, replacement(trading[1], "2"), latest, uuid4()
        ),
    )
    assert moved.body["revisionNo"] == 3 and stale == "PRECONDITION_FAILED"


@pytest.mark.parametrize("posted", [False, True])
def test_cash_grant_revoked_in_another_connection_after_separation_rolls_back(
    client, engine, actor, trading, posted
):
    identifier = ready_with_money(engine, actor, trading, posted=posted)
    condition = token(engine, actor, identifier)
    raw = client.headers["Authorization"].removeprefix("Bearer ")
    separated, revoked = Event(), Event()

    def cancel():
        with Session(engine) as session:
            auth = AuthService(session, client.app.state.settings, Mock())
            principal = auth.authenticate(raw)

            def authorize(required):
                if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                    raise AuthError(403, "FORBIDDEN", "Denied")

            service = use_case(session, actor, authorize)
            replay = service.settlement.replay

            def pause(*args, **kwargs):
                result = replay(*args, **kwargs)
                separated.set()
                assert revoked.wait(race_timeout(10))
                return result

            try:
                with patch.object(service.settlement, "replay", side_effect=pause):
                    return service.cancel(
                        identifier, Reason(reason="No delivery"), condition, uuid4()
                    )
            except AuthError as error:
                return error.code

    with ThreadPoolExecutor(1) as pool:
        future = pool.submit(cancel)
        try:
            assert separated.wait(race_timeout(15))
            with engine.begin() as connection:
                connection.execute(
                    text("""UPDATE dms.group_permission SET "isAllowed"=false
                    WHERE "groupId"=1 AND "functionId"=(
                    SELECT id FROM dms.app_function WHERE code='cash.receipt.post')""")
                )
            before = snapshot(engine)
        finally:
            revoked.set()
        assert future.result(timeout=race_timeout(15)) == "FORBIDDEN"
    assert snapshot(engine) == before
