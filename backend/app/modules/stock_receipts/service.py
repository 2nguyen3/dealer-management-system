from uuid import UUID

from psycopg.errors import SerializationFailure
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.common.catalogue import CatalogueService
from app.common.commands import CommandResult, CommandScope, internal_substep_key
from app.common.values import validate_number
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.document_core.schemas import (
    DocumentList,
    DocumentSummary,
    DraftLine,
    MutationResult,
)
from app.modules.document_core.service import DocumentService, exact_total, line_amount
from app.modules.inventory.repository import InventoryRepository
from app.modules.stock_receipts.repository import StockReceiptRepository


class StockReceiptService(CatalogueService):
    repository = StockReceiptRepository
    response_model = DocumentSummary
    list_model = DocumentList
    permission = "stock.receipt.prepare"
    operation = "listStockReceipts"
    search_fields = ("code", "note", "snapshotNames")
    sorts = {
        sort: (field,) if field == "id" else (field, "id")
        for field in ("id", "businessDate", "totalAmount", "createdAt")
        for sort in (field, "-" + field)
    }

    def __init__(self, session, codec, actor_id, request_id, authorize):
        super().__init__(session, codec, actor_id, request_id, authorize)
        self.core = DocumentService(session, codec, actor_id, request_id, authorize)
        self.inventory = InventoryRepository(session)

    def get(self, identifier):
        if self.core.repo.document(identifier, lock=True)["kind"] != "STOCK_RECEIPT":
            raise ApiError(404, "NOT_FOUND", "Stock receipt not found")
        return self.core.get(identifier)

    def etag(self, item):
        return self.core.etag(item)

    def list(self, *, fromDate=None, toDate=None, sort="-businessDate", **filters):
        if fromDate is not None and toDate is not None and fromDate >= toDate:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid business-date interval")
        return super().list(fromDate=fromDate, toDate=toDate, sort=sort, **filters)

    def result(self, identifier, *, status=200, products=(), location=None) -> CommandResult:
        # Called only inside an already authorized workflow; documents.cancel alone
        # must not acquire an undeclared receipt-read permission prerequisite.
        item = self.core.get(identifier, check_permission=False)
        revision = item.currentRevision
        result = MutationResult(
            id=item.id,
            code=item.code,
            kind=item.kind,
            status=item.status,
            revisionNo=revision.revisionNo,
            revisionId=revision.id,
            businessDate=revision.businessDate,
            totalAmount=revision.totalAmount,
            immediatePayment=revision.immediatePayment,
            remainingAtIssue=None,
            autoReceiptId=None,
            separateReceiptId=None,
            agencyBalance=None,
            inventoryChanges=self.inventory.changes(products),
        )
        headers = {"ETag": self.etag(item)}
        if location is not None:
            headers["Location"] = location
        return CommandResult(status=status, body=result.model_dump(mode="json"), headers=headers)

    def command(self, operation, scope, key, payload, permission, work):
        def authorize():
            set_audit_context(
                self.session, self.actor_id, self.request_id, function_code=permission
            )
            self.authorize((permission,))

        return TransactionRunner(self.session).run(
            CommandScope(self.actor_id, operation, scope, key),
            payload,
            authorize=authorize,
            work=work,
        )

    def create(self, body, key: UUID):
        def work(command):
            identifiers = [int(line.productId) for line in body.lines]
            if len(set(identifiers)) != len(identifiers):
                raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has a line")
            products = self.core.repo.lock_products(identifiers, active=False)
            self.authorize((self.permission,))
            prepared = [DraftLine(kind="STOCK_RECEIPT", **line.model_dump()) for line in body.lines]
            values = [
                self.core.line_values("STOCK_RECEIPT", line, products[int(line.productId)])
                for line in prepared
            ]
            total = exact_total(line_amount(line) for line in prepared)
            identifier = self.core.create_draft(
                "STOCK_RECEIPT",
                body.businessDate,
                internal_substep_key(command.id, "document"),
                note=body.note,
            )
            revision_id = self.core.repo.document(identifier)["currentRevisionId"]
            for line in values:
                self.core.repo.put_line(revision_id, line)
            self.core.repo.set_total(revision_id, total)
            return lambda: self.result(
                identifier, status=201, location=f"/api/v1/stock-receipts/{identifier}"
            )

        return self.command(
            "createStockReceipt", "stock-receipts", key, body.model_dump(), self.permission, work
        )

    def lock_draft(self, identifier, condition, permission, *, discovered=None):
        document, revision = self.core.repo.lock_current(identifier)
        self.authorize((permission,))
        if document["kind"] != "STOCK_RECEIPT":
            raise ApiError(404, "NOT_FOUND", "Stock receipt not found")
        if discovered is not None and self.core.repo.product_ids(identifier) != discovered:
            raise DBAPIError(None, None, SerializationFailure("Document dependencies changed"))
        condition.compare(self.etag(self.core.get(identifier, check_permission=False)))
        if document["status"] != "DRAFT" or revision["state"] != "DRAFT":
            raise ApiError(409, "STATE_CONFLICT", "Only the current draft is editable")
        return document, revision

    def update(self, identifier, body, condition):
        def work():
            _, revision = self.lock_draft(identifier, condition, self.permission)
            self.session.execute(
                REVISION.update()
                .where(REVISION.c.id == revision["id"])
                .values(**body.model_dump(exclude_unset=True))
            )
            return lambda: self.get(identifier)

        return self.write(work)

    def post(self, identifier, condition, key: UUID):
        def work(command):
            discovered = self.core.repo.product_ids(identifier)
            products = self.core.repo.lock_products(discovered, active=False)
            self.inventory.lock_balances(discovered)
            document, revision = self.lock_draft(
                identifier, condition, "stock.receipt.post", discovered=discovered
            )
            lines = self.core.repo.lines(revision["id"])
            if not lines:
                raise ApiError(409, "EMPTY_DOCUMENT", "Receipt requires at least one line")
            for line in lines:
                body = DraftLine(
                    kind="STOCK_RECEIPT",
                    productId=str(line["productId"]),
                    quantity=line["quantity"],
                    unitPrice=line["unitPrice"],
                )
                values = self.core.line_values("STOCK_RECEIPT", body, products[line["productId"]])
                self.core.repo.put_line(revision["id"], values, line["id"])
            total = exact_total(line["lineAmount"] for line in lines)
            if total <= 0:
                raise ApiError(409, "INVALID_TOTAL", "Posted receipt requires a positive total")
            current = {
                int(item.productId): item.currentStock
                for item in self.inventory.changes(discovered)
            }
            for line in lines:
                try:
                    validate_number(current[line["productId"]] + line["quantity"], kind="Quantity")
                except ValueError:
                    raise ApiError(
                        409, "STOCK_OVERFLOW", "Receipt exceeds the stored stock range"
                    ) from None
            self.core.repo.set_total(revision["id"], total)
            self.session.execute(
                DOCUMENT.update().where(DOCUMENT.c.id == identifier).values(status="POSTED")
            )
            self.session.execute(
                REVISION.update()
                .where(REVISION.c.id == revision["id"])
                .values(state="POSTED", postedBy=self.actor_id, postedAt=text("clock_timestamp()"))
            )
            batch = self.core.repo.append_batch(
                revision["id"],
                "POST",
                internal_substep_key(command.id, "post-batch"),
                self.actor_id,
            )
            order = self.core.repo.document(identifier)["businessOrder"]
            self.inventory.append(batch, lines, revision["businessDate"], order)
            return lambda: self.result(identifier, products=discovered)

        return self.command(
            "postStockReceipt", f"stock-receipt:{identifier}", key, {}, "stock.receipt.post", work
        )

    def cancel_draft(self, identifier, reason, condition, key: UUID):
        """Internal M15 branch. Whole cancellation is published only at M29."""

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
            "cancelStockReceipt",
            f"stock-receipt:{identifier}",
            key,
            reason.model_dump(),
            "documents.cancel",
            work,
        )
