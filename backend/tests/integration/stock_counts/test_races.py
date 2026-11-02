from uuid import uuid4

import pytest
from sqlalchemy import text

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.stock_counts.service import StockCountService
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.stock_adjustments.test_adjustments import (
    create as adjustment,
)
from tests.integration.stock_adjustments.test_adjustments import (
    service as adjustments,
)
from tests.integration.stock_counts.test_counts import create

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("leading", ["count", "movement"])
def test_count_confirm_and_stock_movement_both_winners(client, engine, actor, trading, leading):
    counted = create(client, trading["product"], "100")
    movement = adjustment(client, trading["product"], "1")

    def confirm(session):
        use = StockCountService(
            session, CursorCodec(b"x" * 32), actor, "count-race", lambda _: None
        )
        # HTTP cursor/ETag key differs from direct service codec only for cursors, not ETags.
        return use.confirm(
            int(counted.json()["id"]), Preconditions(counted.headers["ETag"]), uuid4()
        )

    def move(session):
        return adjustments(session, actor).post(
            int(movement.json()["id"]), Preconditions(movement.headers["ETag"]), uuid4()
        )

    first, second = ordered_race(
        engine, confirm if leading == "count" else move, move if leading == "count" else confirm
    )
    assert first.status == 200
    if leading == "movement":
        assert second == "STALE_STOCK_SNAPSHOT"
    else:
        assert second.body["status"] == "POSTED"
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 101
