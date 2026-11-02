from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.online_payments.schemas import Checkout, OnlinePaymentCreate
from tests.integration.online_payments.test_recovery import use
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_tx1_unknown_and_setup_definite_failure_recover_same_identity(engine, actor, trading):
    agency, product = int(trading["agency"]), int(trading["product"])
    adapter = Mock()
    adapter.create_checkout.return_value = Checkout(
        checkoutUrl="https://controlled.test/a", expiresAt="2026-12-01T00:00:00Z"
    )
    failure = DBAPIError(None, None, Exception("synthetic"), connection_invalidated=True)
    with Session(engine) as session:
        issue(session, actor, (agency, product), day=4)
        commit(session)
        online = use(session, actor, adapter)
        body = OnlinePaymentCreate(agencyId=str(agency), provider="CONTROLLED", amount="102")
        key = uuid4()
        original = session.commit

        def lost():
            original()
            raise failure

        with patch.object(session, "commit", side_effect=lost):
            with pytest.raises(ApiError, match="COMMAND_OUTCOME_UNKNOWN"):
                online.create(body, key)
        with engine.connect() as check:
            assert check.scalar(text("SELECT count(*) FROM dms.online_payment")) == 1
        recovered = online.create(body, key)
        assert recovered.status == 201
        adapter.create_checkout.side_effect = ApiError(503, "PROVIDER_UNAVAILABLE", "lost")
        pending = online.create(body, uuid4())
        identifier = int(pending.body["id"])
        command = session.scalar(
            text("SELECT id FROM dms.api_idempotency WHERE result->'body'->>'id'=:id"),
            {"id": str(identifier)},
        )
        session.rollback()
        adapter.create_checkout.side_effect = None
        with patch.object(session, "commit", side_effect=failure):
            assert online.setup(identifier, command).status == 202
        assert online.setup(identifier, command).status == 201
        with patch.object(session, "commit", side_effect=RuntimeError("definite-commit")):
            with pytest.raises(RuntimeError):
                online.create(body, uuid4())
