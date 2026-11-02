from threading import Event
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import AuthError
from app.core.request_context import set_audit_context
from app.modules.auth.service import AuthService
from app.modules.credit_applications.service import CreditApplicationService
from app.modules.settlement_core.repository import SettlementRepository
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.user_groups.test_group_concurrency import wait_for_blocker
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def test_live_apply_permission_revoked_during_balance_lock_wait(
    credit_client, engine, actor, trading
):
    client = credit_client
    created = client.post(
        "/api/v1/credit-applications",
        json={"agencyId": trading["agency"], "businessDate": "2026-01-05", "amount": "1"},
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert created.status_code == 201, created.text
    reached = Event()

    def revoke(session):
        SettlementRepository(session).lock_agency(int(trading["agency"]))
        set_audit_context(session, actor, "revoke-credit", function_code="permissions.manage")
        session.execute(
            text("""
            UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1
              AND "functionId"=(SELECT id FROM dms.app_function WHERE code='credit.apply')
        """)
        )
        session.commit()
        return "revoked"

    def attempt(session):
        auth = AuthService(session, client.app.state.settings, client.app.state.reset_delivery)
        principal = auth.authenticate(client.headers["Authorization"].removeprefix("Bearer "))

        def authorize(required):
            if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                raise AuthError(403, "FORBIDDEN", "Permission denied")

        use = CreditApplicationService(
            session, CursorCodec(b"x" * 32), actor, "wait-test", authorize
        )
        original = use.settlement.repo.lock_agency

        def lock(identifier):
            reached.set()
            return original(identifier)

        with patch.object(use.settlement.repo, "lock_agency", side_effect=lock):
            return use.post(
                int(created.json()["id"]), Preconditions(created.headers["ETag"]), uuid4()
            )

    def observe(database, pid):
        assert reached.wait(race_timeout(10))
        wait_for_blocker(database, pid)

    with patch("tests.integration.catalogues.test_races.wait_for_blocker", new=observe):
        first, second = ordered_race(engine, revoke, attempt)
    assert first == "revoked" and second == "FORBIDDEN"
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT status FROM dms.document WHERE kind='CREDIT_APPLICATION'")
            )
            == "DRAFT"
        )
