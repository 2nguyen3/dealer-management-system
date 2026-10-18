from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.stock_adjustments.schemas import StockAdjustmentCreate
from tests.integration.stock_adjustments.test_adjustments import create, post, service

pytestmark = pytest.mark.integration


def test_adjustment_guards_and_mid_append_rollback(client, engine, actor, trading):
    body = StockAdjustmentCreate(
        businessDate="2026-01-02",
        reason="Damage",
        lines=[{"productId": trading["product"], "quantity": "1"}] * 2,
    )
    with Session(engine) as session:
        use = service(session, actor)
        with pytest.raises(ApiError, match="DUPLICATE_PRODUCT"):
            use.create(body, uuid4())
    fractional = create(client, trading["product"], lines=[])
    empty = post(client, fractional)
    assert empty.status_code == 409 and empty.json()["code"] == "EMPTY_DOCUMENT"
    created = create(client, trading["product"], "1")
    identifier = int(created.json()["id"])
    with Session(engine) as session:
        use = service(session, actor)
        receipt = session.scalar(text("SELECT id FROM dms.document WHERE kind='STOCK_RECEIPT'"))
        with pytest.raises(ApiError, match="NOT_FOUND"):
            use.get(receipt)
        with pytest.raises(ApiError, match="NOT_FOUND"):
            use.lock_draft(receipt, Preconditions(created.headers["ETag"]), use.permission)
        with pytest.raises(DBAPIError):
            use.lock_draft(
                identifier, Preconditions(created.headers["ETag"]), use.permission, discovered=()
            )
        session.rollback()
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            use.post_internal(receipt, uuid4())
        session.rollback()
        session.execute(
            text(
                "UPDATE dms.document_revision SET reason=NULL "
                'WHERE id=(SELECT "currentRevisionId" FROM dms.document WHERE id=:id)'
            ),
            {"id": identifier},
        )
        session.commit()
        current = use.get(identifier)
        with pytest.raises(ApiError, match="REASON_REQUIRED"):
            use.post(identifier, Preconditions(use.etag(current)), uuid4())
    changed = client.patch(
        created.headers["Location"],
        json={"reason": "Restored"},
        headers={"If-Match": client.get(created.headers["Location"]).headers["ETag"]},
    )
    assert changed.status_code == 200, changed.text
    with Session(engine) as session:
        use = service(session, actor)
        original = use.inventory.append

        def fail(*args, **kwargs):
            original(*args, **kwargs)
            raise RuntimeError("injected after ledger append")

        with patch.object(use.inventory, "append", side_effect=fail), pytest.raises(RuntimeError):
            use.post(identifier, Preconditions(changed.headers["ETag"]), uuid4())
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM dms.inventory_entry")) == 1
        assert (
            connection.scalar(
                text("SELECT status FROM dms.document WHERE id=:id"), {"id": identifier}
            )
            == "DRAFT"
        )
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM dms.api_idempotency "
                    "WHERE \"operationId\"='postStockAdjustment'"
                )
            )
            == 0
        )
