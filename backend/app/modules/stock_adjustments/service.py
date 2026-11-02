from psycopg.errors import SerializationFailure
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.common.commands import internal_substep_key
from app.common.values import validate_number
from app.core.exceptions import ApiError
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.document_core.schemas import DraftLine
from app.modules.stock_adjustments.repository import StockAdjustmentRepository
from app.modules.stock_receipts.service import StockReceiptService


class StockAdjustmentService(StockReceiptService):
    repository = StockAdjustmentRepository
    permission = "stock.adjustment.prepare"
    operation = "listStockAdjustments"

    def get(self, identifier):
        if self.core.repo.document(identifier, lock=True)["kind"] != "STOCK_ADJUSTMENT":
            raise ApiError(404, "NOT_FOUND", "Stock adjustment not found")
        return self.core.get(identifier)

    def list(self, **filters):
        self.core.authorize_read("STOCK_ADJUSTMENT")
        return super().list(**filters)

    def independent(self, identifier):
        if self.session.scalar(
            text('SELECT EXISTS(SELECT 1 FROM dms.stock_count WHERE "adjustmentDocumentId"=:id)'),
            {"id": identifier},
        ):
            raise ApiError(
                409, "COUNT_LINKED_ADJUSTMENT", "Count adjustment is not independently editable"
            )

    def lock_draft(self, identifier, condition, permission, *, discovered=None):
        document, revision = self.core.repo.lock_current(identifier)
        self.authorize((permission,))
        if document["kind"] != "STOCK_ADJUSTMENT":
            raise ApiError(404, "NOT_FOUND", "Stock adjustment not found")
        if discovered is not None and self.core.repo.product_ids(identifier) != discovered:
            raise DBAPIError(None, None, SerializationFailure("Document dependencies changed"))
        self.independent(identifier)
        condition.compare(self.etag(self.core.get(identifier, check_permission=False)))
        if document["status"] != "DRAFT" or revision["state"] != "DRAFT":
            raise ApiError(409, "STATE_CONFLICT", "Only the current draft is editable")
        return document, revision

    def create_internal(self, body, key, products):
        """No commit or command claim; caller supplies ordered master/stock locks."""
        identifiers = [int(line.productId) for line in body.lines]
        if len(set(identifiers)) != len(identifiers):
            raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has a line")
        values = [
            self.core.line_values(
                "STOCK_ADJUSTMENT",
                DraftLine(kind="STOCK_ADJUSTMENT", unitPrice="0", **line.model_dump()),
                products[int(line.productId)],
            )
            for line in body.lines
        ]
        identifier = self.core.create_draft(
            "STOCK_ADJUSTMENT", body.businessDate, key, reason=body.reason, note=body.note
        )
        revision = self.core.repo.document(identifier)["currentRevisionId"]
        for line in values:
            self.core.repo.put_line(revision, line)
        return identifier

    def create(self, body, key):
        def work(command):
            products = self.core.repo.lock_products(
                (int(line.productId) for line in body.lines), active=False
            )
            self.authorize((self.permission,))
            identifier = self.create_internal(
                body, internal_substep_key(command.id, "document"), products
            )
            return lambda: self.result(
                identifier, status=201, location=f"/api/v1/stock-adjustments/{identifier}"
            )

        return self.command(
            "createStockAdjustment",
            "stock-adjustments",
            key,
            body.model_dump(),
            self.permission,
            work,
        )

    def post_internal(self, identifier, key):
        """No commit. M22 confirms/links the snapshot before calling this seam."""
        document, revision = self.core.repo.lock_current(identifier)
        self.authorize(("stock.adjustment.post",))
        if (
            document["kind"] != "STOCK_ADJUSTMENT"
            or document["status"] != "DRAFT"
            or revision["state"] != "DRAFT"
        ):
            raise ApiError(409, "STATE_CONFLICT", "Only an adjustment draft can be posted")
        lines = self.core.repo.lines(revision["id"])
        if not lines:
            raise ApiError(409, "EMPTY_DOCUMENT", "Adjustment requires at least one line")
        if not revision["reason"] or not revision["reason"].strip():
            raise ApiError(409, "REASON_REQUIRED", "Adjustment requires a reason")
        current = {
            int(item.productId): item.currentStock
            for item in self.inventory.changes(line["productId"] for line in lines)
        }
        for line in lines:
            try:
                validate_number(current[line["productId"]] + line["quantity"], kind="Quantity")
            except ValueError:
                raise ApiError(
                    409, "STOCK_CONFLICT", "Adjustment exceeds the stock range"
                ) from None
            minimum = self.session.scalar(
                text("""
                WITH checkpoints AS (
                  SELECT "businessDate","businessOrder",sum(quantity) AS quantity
                  FROM dms.inventory_entry WHERE "productId"=:product
                  GROUP BY "businessDate","businessOrder"
                  UNION ALL SELECT CAST(:day AS date),CAST(:ordering AS bigint),
                    CAST(:delta AS numeric)
                ), balances AS (
                  SELECT sum(quantity) OVER(ORDER BY "businessDate","businessOrder"
                    RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance
                  FROM checkpoints
                ) SELECT min(balance) FROM balances
                """),
                {
                    "product": line["productId"],
                    "day": revision["businessDate"],
                    "ordering": 9223372036854775807,
                    "delta": line["quantity"],
                },
            )
            if minimum < 0:
                raise ApiError(409, "STOCK_CONFLICT", "Adjustment makes historical stock negative")
        self.session.execute(
            DOCUMENT.update().where(DOCUMENT.c.id == identifier).values(status="POSTED")
        )
        self.session.execute(
            REVISION.update()
            .where(REVISION.c.id == revision["id"])
            .values(state="POSTED", postedBy=self.actor_id, postedAt=text("clock_timestamp()"))
        )
        batch = self.core.repo.append_batch(revision["id"], "POST", key, self.actor_id)
        order = self.core.repo.document(identifier)["businessOrder"]
        self.inventory.append(batch, lines, revision["businessDate"], order)

    def post(self, identifier, condition, key):
        def work(command):
            discovered = self.core.repo.product_ids(identifier)
            self.core.repo.lock_products(discovered, active=False)
            self.inventory.lock_balances(discovered)
            self.lock_draft(identifier, condition, "stock.adjustment.post", discovered=discovered)
            self.post_internal(identifier, internal_substep_key(command.id, "post"))
            return lambda: self.result(identifier, products=discovered)

        return self.command(
            "postStockAdjustment",
            f"stock-adjustment:{identifier}",
            key,
            {},
            "stock.adjustment.post",
            work,
        )

    def cancel_draft(self, identifier, reason, condition, key):
        def work(command):
            self.lock_draft(identifier, condition, "documents.cancel")
            self.session.execute(
                DOCUMENT.update()
                .where(DOCUMENT.c.id == identifier)
                .values(
                    status="CANCELLED",
                    cancelledBy=self.actor_id,
                    cancelledAt=text("clock_timestamp()"),
                    cancelReason=reason.reason,
                )
            )
            return lambda: self.result(identifier)

        return self.command(
            "cancelStockAdjustment",
            f"stock-adjustment:{identifier}",
            key,
            reason.model_dump(),
            "documents.cancel",
            work,
        )
