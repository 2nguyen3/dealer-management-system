from datetime import UTC, datetime
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError, AuthError
from app.modules.stock_adjustments.service import StockAdjustmentService
from app.modules.stock_counts.schemas import CountLineInput, StockCountCreate, StockRecount
from app.modules.stock_counts.service import StockCountService

pytestmark = pytest.mark.integration


def test_count_failure_boundaries_and_atomic_confirmation_rollback(engine, actor, trading):
    with Session(engine) as session:
        use = StockCountService(
            session, CursorCodec(b"x" * 32), actor, "count-guards", lambda _: None
        )
        body = StockCountCreate(
            countedAt="2026-01-02T10:00:00Z",
            lines=[{"productId": trading["product"], "countedQuantity": "99"}],
        )
        with pytest.raises(ApiError, match="DUPLICATE_PRODUCT"):
            use.create(body.model_copy(update={"lines": body.lines * 2}), uuid4())
        with pytest.raises(ApiError, match="INVALID_QUANTITY"):
            use.create(
                StockCountCreate(
                    countedAt=body.countedAt,
                    lines=[{"productId": trading["product"], "countedQuantity": "0.5"}],
                ),
                uuid4(),
            )
        empty = use.create(StockCountCreate(countedAt=body.countedAt), uuid4())
        with pytest.raises(ApiError, match="EMPTY_COUNT"):
            use.confirm(int(empty.body["id"]), Preconditions(empty.headers["ETag"]), uuid4())
        created = use.create(body, uuid4())
        identifier = int(created.body["id"])
        condition = Preconditions(created.headers["ETag"])
        with pytest.raises(ApiError, match="NOT_FOUND"):
            use.get(999999)
        with pytest.raises(ApiError, match="NOT_FOUND"):
            use.get_line(identifier, 999999)
        session.rollback()
        with pytest.raises(ApiError, match="DUPLICATE_PRODUCT"):
            use.create_line(identifier, body.lines[0], condition, uuid4())
        for lines in (body.lines * 2, [CountLineInput(productId="99999", countedQuantity="1")]):
            with pytest.raises(ApiError, match="RECOUNT_PRODUCTS"):
                use.recount(
                    identifier,
                    StockRecount(countedAt=body.countedAt, reason="Fresh count", lines=lines),
                    condition,
                    uuid4(),
                )
        with pytest.raises(ApiError, match="REASON_REQUIRED"):
            use.confirm(identifier, condition, uuid4())

        def deny(permissions):
            if "stock.adjustment.post" in permissions:
                raise AuthError(403, "FORBIDDEN", "Permission denied")

        with patch.object(use, "authorize", side_effect=deny), pytest.raises(AuthError):
            use.confirm(identifier, condition, uuid4())
        session.execute(
            text("UPDATE dms.stock_count SET reason='Verified damage' WHERE id=:id"),
            {"id": identifier},
        )
        session.commit()
        condition = Preconditions(use.etag(use.get(identifier)))
        original = StockAdjustmentService.post_internal

        def fail(service, *args, **kwargs):
            original(service, *args, **kwargs)
            raise RuntimeError("after linked posting")

        with (
            patch.object(StockAdjustmentService, "post_internal", new=fail),
            pytest.raises(RuntimeError),
        ):
            use.confirm(identifier, condition, uuid4())
        assert use.get(identifier).state == "DRAFT"
        assert use.get(identifier).adjustmentDocumentId is None
        session.rollback()
        with (
            patch.object(use.repo, "product_ids", side_effect=[(), (int(trading["product"]),)]),
            pytest.raises(DBAPIError),
        ):
            use.lock(identifier, condition)
        session.rollback()
        for kwargs in (
            {"sort": "bad"},
            {
                "countedFrom": datetime(2026, 1, 1, tzinfo=UTC),
                "countedTo": datetime(2026, 1, 1, tzinfo=UTC),
            },
        ):
            with pytest.raises(ApiError, match="VALIDATION_FAILED"):
                use.list(**kwargs)
        with pytest.raises(ApiError, match="VALIDATION_FAILED"):
            use.lines(identifier, sort="bad")
        for sort in ("id", "-id", "countedAt", "-countedAt"):
            page = use.list(limit=1, sort=sort)
            assert page.pagination.hasMore
            after = use.list(limit=1, sort=sort, cursor=page.pagination.nextCursor)
            assert after.items[0].id != page.items[0].id
        for sort in ("id", "-id"):
            page = use.lines(
                identifier, productId=trading["product"], hasDifference=True, sort=sort
            )
            assert len(page.items) == 1
            token = use.codec.encode(
                {
                    "operation": "listStockCountLines",
                    "parent": identifier,
                    "productId": None,
                    "hasDifference": None,
                    "sort": sort,
                },
                [int(page.items[0].id)],
            )
            assert use.lines(identifier, sort=sort, cursor=token).items == []
        assert use.lines(identifier, productId="99999").items == []
        assert use.lines(identifier, hasDifference=False).items == []
    with engine.connect() as connection:
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 100
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.document WHERE kind='STOCK_ADJUSTMENT'")
            )
            == 0
        )
