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
from app.modules.inventory.repository import InventoryRepository
from app.modules.stock_adjustments.service import StockAdjustmentService
from app.modules.stock_counts.service import StockCountService
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.stock_adjustments.test_adjustments import create as adjustment
from tests.integration.stock_counts.test_counts import create as count
from tests.integration.user_groups.test_group_concurrency import wait_for_blocker
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("resource", ["adjustment", "count"])
def test_live_post_permission_revoked_while_waiting_for_stock(
    client, engine, actor, trading, resource
):
    reached_stock = Event()
    created = (
        adjustment(client, trading["product"], "-1")
        if resource == "adjustment"
        else count(client, trading["product"], "99")
    )

    def revoke(session):
        InventoryRepository(session).lock_balances((int(trading["product"]),))
        set_audit_context(
            session, actor, "revoke-adjustment-post", function_code="permissions.manage"
        )
        session.execute(
            text("""UPDATE dms.group_permission SET "isAllowed"=false
          WHERE "groupId"=1 AND "functionId"=(SELECT id FROM dms.app_function
            WHERE code='stock.adjustment.post')""")
        )
        session.commit()
        return "revoked"

    def attempt(session):
        auth = AuthService(session, client.app.state.settings, client.app.state.reset_delivery)
        principal = auth.authenticate(client.headers["Authorization"].removeprefix("Bearer "))

        def authorize(required):
            if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                raise AuthError(403, "FORBIDDEN", "Permission denied")

        kind = StockAdjustmentService if resource == "adjustment" else StockCountService
        use = kind(session, CursorCodec(b"x" * 32), actor, "post-after-lock", authorize)
        action = use.post if resource == "adjustment" else use.confirm
        original_lock = use.inventory.lock_balances

        def lock_balances(identifiers):
            reached_stock.set()
            return original_lock(identifiers)

        with patch.object(use.inventory, "lock_balances", side_effect=lock_balances):
            return action(
                int(created.json()["id"]), Preconditions(created.headers["ETag"]), uuid4()
            )

    def observe_stock_wait(database, pid):
        assert reached_stock.wait(race_timeout(10)), "Writer did not reach stock lock"
        wait_for_blocker(database, pid)

    with patch("tests.integration.catalogues.test_races.wait_for_blocker", new=observe_stock_wait):
        first, second = ordered_race(engine, revoke, attempt)
    assert first == "revoked" and second == "FORBIDDEN"
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 100
        if resource == "count":
            assert connection.scalar(text("SELECT state FROM dms.stock_count")) == "DRAFT"
            assert (
                connection.scalar(
                    text("SELECT count(*) FROM dms.document WHERE kind='STOCK_ADJUSTMENT'")
                )
                == 0
            )
        else:
            assert (
                connection.scalar(
                    text("SELECT status FROM dms.document WHERE kind='STOCK_ADJUSTMENT'")
                )
                == "DRAFT"
            )
