from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import AuthError
from app.modules.auth.service import AuthService
from app.modules.settlement_core.repository import SettlementRepository
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.settlement_core.helpers import commit, financial, issue, service

pytestmark = pytest.mark.integration


def test_competing_receipts_serialize_one_winner_without_historical_overpay(engine, actor, trading):
    with Session(engine) as session:
        issue(session, actor, trading)
        first = financial(session, actor, trading[0], 80)
        second = financial(session, actor, trading[0], 80)
        commit(session)

    def post(session, identifier):
        result = service(session, actor).post_receipt(identifier, uuid4())
        commit(session)
        return result.debt

    leading, following = ordered_race(engine, lambda s: post(s, first), lambda s: post(s, second))
    assert leading == 22 and following == "PAYMENT_EXCEEDS_DEBT"
    with Session(engine) as session:
        assert SettlementRepository(session).source(first)["status"] == "POSTED"
        assert SettlementRepository(session).source(second)["status"] == "DRAFT"
        assert SettlementRepository(session).balance(trading[0])["debt"] == 22
        assert session.scalar(text("SELECT count(*) FROM dms.receivable_entry")) == 2


def test_current_auth_permission_is_rechecked_after_observed_agency_balance_wait(
    engine, actor, trading
):
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
    )
    with Session(engine) as session:
        issue(session, actor, trading)
        receipt = financial(session, actor, trading[0], 80)
        commit(session)
        auth = AuthService(session, settings, None)
        tokens = auth.login("test@example.com", "password")
        principal = auth.authenticate(tokens.accessToken)

    def revoke(session):
        service(session, actor).lock(trading[0], "cash.receipt.post")
        session.execute(
            text("""
            UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1
              AND "functionId"=(SELECT id FROM dms.app_function WHERE code='cash.receipt.post')
        """)
        )
        commit(session)
        return "revoked"

    def post(session):
        auth = AuthService(session, settings, None)

        def authorize(required):
            if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                raise AuthError(403, "FORBIDDEN", "Permission denied")

        result = service(session, actor, authorize).post_receipt(receipt, uuid4())
        commit(session)
        return result

    leading, following = ordered_race(engine, revoke, post)
    assert leading == "revoked" and following == "FORBIDDEN"
    with Session(engine) as session:
        assert SettlementRepository(session).source(receipt)["state"] == "DRAFT"
        assert session.scalar(text("SELECT count(*) FROM dms.receivable_entry")) == 1
