from threading import Event
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import AuthError
from app.core.request_context import set_audit_context
from app.modules.auth.service import AuthService
from app.modules.refunds.schemas import ManualRefundConfirmation, RefundCreate
from app.modules.refunds.service import RefundService
from app.modules.settlement_core.repository import SettlementRepository
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.settlement_core.helpers import commit
from tests.integration.settlement_core.test_reservations import credit_cash
from tests.integration.user_groups.test_group_concurrency import wait_for_blocker
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


def test_refund_post_grant_revoked_during_real_balance_wait(client, engine, actor, trading):
    with Session(engine) as session:
        receipt, _ = credit_cash(
            session, actor, (int(trading["agency"]), int(trading["product"])), 100
        )
        commit(session)
        use = RefundService(session, CursorCodec(b"x" * 32), actor, "prepare", lambda _: None)
        draft = use.create(
            RefundCreate(
                originDocumentId=str(receipt),
                businessDate="2026-01-04",
                amount="40",
                paymentMethod="CASH",
            ),
            uuid4(),
        )
        identifier = int(draft.body["id"])
        ready = use.submit(identifier, Preconditions(draft.headers["ETag"]), uuid4())
    reached = Event()

    def revoke(session):
        SettlementRepository(session).lock_agency(int(trading["agency"]))
        set_audit_context(session, actor, "revoke-refund", function_code="permissions.manage")
        session.execute(
            text(
                'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
                "AND \"functionId\"=(SELECT id FROM dms.app_function WHERE code='cash.refund.post')"
            )
        )
        session.commit()
        return "revoked"

    def attempt(session):
        auth = AuthService(session, client.app.state.settings, client.app.state.reset_delivery)
        principal = auth.authenticate(client.headers["Authorization"].removeprefix("Bearer "))

        def authorize(required):
            if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                raise AuthError(403, "FORBIDDEN", "Permission denied")

        use = RefundService(session, CursorCodec(b"x" * 32), actor, "after-wait", authorize)
        original = use.settlement.repo.lock_agency

        def lock(identifier):
            reached.set()
            return original(identifier)

        with patch.object(use.settlement.repo, "lock_agency", side_effect=lock):
            return use.confirm_paid(
                identifier,
                ManualRefundConfirmation(paidAt="2026-01-05T00:00:00Z", evidenceReference="cash"),
                Preconditions(ready.headers["ETag"]),
                uuid4(),
            )

    def observe(database, pid):
        assert reached.wait(race_timeout(10))
        wait_for_blocker(database, pid)

    with patch("tests.integration.catalogues.test_races.wait_for_blocker", new=observe):
        assert ordered_race(engine, revoke, attempt) == ("revoked", "FORBIDDEN")
    with engine.connect() as check:
        assert check.scalar(text("SELECT status FROM dms.document WHERE kind='REFUND'")) == "DRAFT"
        assert check.scalar(text("SELECT state FROM dms.refund_reservation")) == "ACTIVE"


def test_cancel_replay_requires_each_canonical_grant_even_after_success(
    client, engine, actor, trading
):
    with Session(engine) as session:
        receipt, _ = credit_cash(
            session, actor, (int(trading["agency"]), int(trading["product"])), 100
        )
        commit(session)
        use = RefundService(
            session, CursorCodec(b"x" * 32), actor, "cancel-prepare", lambda _: None
        )
        draft = use.create(
            RefundCreate(
                originDocumentId=str(receipt),
                businessDate="2026-01-04",
                amount="10",
                paymentMethod="CASH",
            ),
            uuid4(),
        )
        identifier = int(draft.body["id"])
        key = uuid4()
        use.cancel(
            identifier,
            Reason(reason="Unpaid cancellation"),
            Preconditions(draft.headers["ETag"]),
            key,
        )
    for grant in ("documents.cancel", "cash.refund.post"):
        with engine.begin() as check:
            check.execute(
                text(
                    'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
                    'AND "functionId"=(SELECT id FROM dms.app_function WHERE code=:code)'
                ),
                {"code": grant},
            )
        with Session(engine) as session:
            auth = AuthService(session, client.app.state.settings, client.app.state.reset_delivery)
            principal = auth.authenticate(client.headers["Authorization"].removeprefix("Bearer "))

            def authorize(required, auth=auth, principal=principal):
                if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                    raise AuthError(403, "FORBIDDEN", "Permission denied")

            use = RefundService(session, CursorCodec(b"x" * 32), actor, "cancel-replay", authorize)
            with pytest.raises(AuthError, match="FORBIDDEN"):
                use.cancel(
                    identifier,
                    Reason(reason="Unpaid cancellation"),
                    Preconditions(draft.headers["ETag"]),
                    key,
                )
        with engine.begin() as check:
            check.execute(
                text(
                    'UPDATE dms.group_permission SET "isAllowed"=true WHERE "groupId"=1 '
                    'AND "functionId"=(SELECT id FROM dms.app_function WHERE code=:code)'
                ),
                {"code": grant},
            )
    with engine.connect() as check:
        assert (
            check.scalar(text("SELECT status FROM dms.document WHERE kind='REFUND'")) == "CANCELLED"
        )
        assert check.scalar(text('SELECT "currentCredit" FROM dms.agency_balance')) == 100
