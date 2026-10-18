from datetime import date
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.sales_returns.schemas import SalesReturnCreate
from app.modules.sales_returns.service import SalesReturnService
from app.modules.stock_receipts.schemas import Reason, StockHeaderUpdate
from tests.integration.catalogues.helpers import install_builders
from tests.integration.settlement_core.helpers import commit, issue

pytestmark = pytest.mark.integration


def test_return_source_guards_draft_cancel_rollback_and_stock_range(engine, actor, trading):
    agency_id, product_id = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        source = issue(session, actor, (agency_id, product_id), quantity=3)
        pending = issue(session, actor, (agency_id, product_id), post=False)
        commit(session)
        use = SalesReturnService(
            session, CursorCodec(b"x" * 32), actor, "return-guards", lambda _: None
        )
        origin = use.repo.origin(source)
        source_line = use.core.repo.lines(origin["currentRevisionId"])[0]
        body = SalesReturnCreate(
            originDocumentId=str(source),
            businessDate="2026-01-04",
            lines=[{"originLineId": str(source_line["id"]), "quantity": "2"}],
        )
        receipt = session.scalar(text("SELECT id FROM dms.document WHERE kind='STOCK_RECEIPT'"))
        for identifier, code in (
            (999999, "NOT_FOUND"),
            (receipt, "RETURN_SOURCE_CONFLICT"),
            (pending, "RETURN_SOURCE_CONFLICT"),
        ):
            with pytest.raises(ApiError, match=code):
                use.create(body.model_copy(update={"originDocumentId": str(identifier)}), uuid4())
        for candidate, code in (
            (body.model_copy(update={"businessDate": date(2026, 1, 1)}), "RETURN_SOURCE_CONFLICT"),
            (body.model_copy(update={"lines": body.lines * 2}), "DUPLICATE_PRODUCT"),
            (
                SalesReturnCreate(
                    originDocumentId=str(source),
                    businessDate=body.businessDate,
                    lines=[{"originLineId": "99999", "quantity": "1"}],
                ),
                "RETURN_SOURCE_CONFLICT",
            ),
            (
                SalesReturnCreate(
                    originDocumentId=str(source),
                    businessDate=body.businessDate,
                    lines=[{"originLineId": str(source_line["id"]), "quantity": "0.5"}],
                ),
                "INVALID_QUANTITY",
            ),
            (
                SalesReturnCreate(
                    originDocumentId=str(source),
                    businessDate=body.businessDate,
                    lines=[{"originLineId": str(source_line["id"]), "quantity": "4"}],
                ),
                "RETURN_QUANTITY_CONFLICT",
            ),
        ):
            with pytest.raises(ApiError, match=code):
                use.create(candidate, uuid4())
        with pytest.raises(ApiError, match="RETURN_SOURCE_CONFLICT"):
            use.prepare_lines(
                {**origin, "currentRevisionId": -1}, body.lines, {}, body.businessDate
            )
        with (
            patch.object(use.repo, "origin_line", return_value={**source_line, "unitPrice": 103}),
            pytest.raises(ApiError, match="RETURN_SOURCE_CONFLICT"),
        ):
            use.prepare_lines(origin, body.lines, {}, body.businessDate)
        session.rollback()
        with (
            patch.object(use.repo, "agency_products", side_effect=[(product_id,), ()]),
            pytest.raises(DBAPIError),
        ):
            use.lock_origin(source, use.permission)
        session.rollback()
        empty = use.create(body.model_copy(update={"lines": []}), uuid4())
        with pytest.raises(ApiError, match="EMPTY_DOCUMENT"):
            use.post(int(empty.body["id"]), Preconditions(empty.headers["ETag"]), uuid4())
        cancelled = use.cancel_draft(
            int(empty.body["id"]),
            Reason(reason="Mistake"),
            Preconditions(empty.headers["ETag"]),
            uuid4(),
        )
        assert cancelled.body["status"] == "CANCELLED"
        created = use.create(body, uuid4())
        identifier = int(created.body["id"])
        updated = use.update(
            identifier,
            StockHeaderUpdate(note="Updated draft", businessDate="2026-01-05"),
            Preconditions(created.headers["ETag"]),
        )
        condition = Preconditions(use.etag(updated))
        original = use.inventory.append

        def fail(*args, **kwargs):
            original(*args, **kwargs)
            raise RuntimeError("after return inventory append")

        with patch.object(use.inventory, "append", side_effect=fail), pytest.raises(RuntimeError):
            use.post(identifier, condition, uuid4())
        session.rollback()
        with engine.connect() as connection:
            assert (
                connection.scalar(
                    text("SELECT status FROM dms.document WHERE id=:id"), {"id": identifier}
                )
                == "DRAFT"
            )
            assert connection.scalar(text('SELECT "currentDebt" FROM dms.agency_balance')) == 306
            assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 97
        posted = use.post(identifier, condition, uuid4())
        assert posted.body["totalAmount"] == "204"
        with pytest.raises(ApiError, match="STATE_CONFLICT"):
            use.post(identifier, Preconditions(posted.headers["ETag"]), uuid4())
        small = use.create(
            SalesReturnCreate(
                originDocumentId=str(source),
                businessDate="2026-01-06",
                lines=[{"originLineId": str(source_line["id"]), "quantity": "1"}],
            ),
            uuid4(),
        )
        install_builders(session, actor)
        incoming = session.scalar(
            text("""SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-05',
          jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
            'quantity',999999999999900,'price',1)),gen_random_uuid())"""),
            {"product": product_id},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": incoming})
        commit(session)
        with pytest.raises(ApiError, match="STOCK_OVERFLOW"):
            use.post(int(small.body["id"]), Preconditions(small.headers["ETag"]), uuid4())
        assert use.get(int(small.body["id"])).status == "DRAFT"
