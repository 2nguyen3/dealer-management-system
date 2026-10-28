from unittest.mock import Mock
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.online_payments.schemas import Checkout, OnlinePaymentCreate
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.online_payments.test_recovery import use
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_setup_race_returns_persisted_winner_and_provider_expiry(engine, actor, trading):
    agency, product = int(trading["agency"]), int(trading["product"])
    adapter = Mock()
    from app.core.exceptions import ApiError

    adapter.create_checkout.side_effect = ApiError(503, "PROVIDER_UNAVAILABLE", "lost")
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=4)
        commit(session)
        created = use(session, actor, adapter).create(
            OnlinePaymentCreate(agencyId=str(agency), provider="CONTROLLED", amount="102"), uuid4()
        )
        command = session.scalar(
            text("SELECT id FROM dms.api_idempotency WHERE \"operationId\"='createOnlinePayment'")
        )

    def setup(session, url):
        local = Mock()
        local.create_checkout.return_value = Checkout(
            checkoutUrl=url, expiresAt="2026-12-01T00:00:00Z"
        )
        # ordered_race intercepts commit; setup's preliminary read rollback must
        # not trigger its leading barrier before setup persistence.
        return (
            use(session, actor, local).setup(int(created.body["id"]), command).body["checkoutUrl"]
        )

    first, second = ordered_race(
        engine,
        lambda s: setup(s, "https://controlled.test/a"),
        lambda s: setup(s, "https://controlled.test/b"),
    )
    assert first == second == "https://controlled.test/a"
    with engine.connect() as check:
        assert (
            check.scalar(text('SELECT "expiresAt"::date::text FROM dms.online_payment'))
            == "2026-12-01"
        )
