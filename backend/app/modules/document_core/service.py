from datetime import date
from decimal import Decimal, localcontext
from uuid import UUID

from psycopg.errors import SerializationFailure
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.common.preconditions import canonical_etag
from app.common.prices import stored_selling_price
from app.common.values import rounded_amount, validate_number
from app.core.exceptions import ApiError, AuthError
from app.modules.document_core.models import REVISION
from app.modules.document_core.repository import DocumentRepository
from app.modules.document_core.schemas import (
    DOCUMENT_MODELS,
    Document,
    DocumentLine,
    DraftLine,
    Revision,
)

READ_PERMISSIONS = {
    "STOCK_RECEIPT": ("stock.receipt.prepare", "stock.receipt.post", "inventory.read"),
    "STOCK_ISSUE": ("stock.issue.prepare", "stock.issue.post", "debt.read", "sales.read"),
    "PAYMENT_RECEIPT": ("cash.receipt.prepare", "cash.receipt.post", "debt.read"),
    "STOCK_ADJUSTMENT": ("stock.adjustment.prepare", "stock.adjustment.post", "inventory.read"),
    "SALES_RETURN": ("returns.prepare", "returns.post", "debt.read", "sales.read"),
    "CREDIT_APPLICATION": ("credit.apply", "debt.read"),
    "REFUND": ("cash.refund.prepare", "cash.refund.post", "debt.read"),
}
PREPARE_PERMISSIONS = {
    "STOCK_RECEIPT": "stock.receipt.prepare",
    "STOCK_ISSUE": "stock.issue.prepare",
    "STOCK_ADJUSTMENT": "stock.adjustment.prepare",
    "SALES_RETURN": "returns.prepare",
}


def exact_total(amounts) -> Decimal:
    try:
        with localcontext() as context:
            context.prec = 64
            return validate_number(sum(amounts, Decimal(0)), kind="Money")
    except ValueError:
        raise ApiError(409, "TOTAL_OVERFLOW", "Document total exceeds the stored range") from None


def line_amount(body: DraftLine) -> Decimal:
    return (
        body.returnAmount
        if body.returnAmount is not None
        else rounded_amount(abs(body.quantity), body.unitPrice)
    )


class DocumentService:
    """Shared document primitives. The calling workflow owns commit and audit context."""

    def __init__(self, session, codec, actor_id, request_id, authorize):
        self.session = session
        self.codec = codec
        self.actor_id = actor_id
        self.request_id = request_id
        self.authorize = authorize
        self.repo = DocumentRepository(session)

    def create_draft(self, kind: str, business_date: date, creation_key: UUID, **values) -> int:
        if kind not in DOCUMENT_MODELS:
            raise ValueError("Invalid document kind")
        return self.repo.create_draft(kind, business_date, creation_key, self.actor_id, **values)

    def authorize_read(self, kind: str) -> None:
        for permission in READ_PERMISSIONS[kind]:
            try:
                self.authorize((permission,))
                return
            except AuthError as error:
                if error.status != 403 or error.code != "FORBIDDEN":
                    raise
                continue
        raise AuthError(403, "FORBIDDEN", "Permission denied")

    def prepare_issue_line(self, product_id: int, quantity) -> DraftLine:
        self.repo.lock_products([product_id])
        source = self.session.execute(
            text("""
            SELECT b."currentPurchasePrice",r."sellingPriceRate"
            FROM dms.inventory_balance b CROSS JOIN dms.business_rule r
            WHERE b."productId"=:id FOR SHARE OF b
        """),
            {"id": product_id},
        ).one()
        if source.currentPurchasePrice <= 0:
            raise ApiError(409, "PRICE_SOURCE_REQUIRED", "Product has no purchase-price source")
        price = stored_selling_price(
            rounded_amount(source.currentPurchasePrice, source.sellingPriceRate)
        )
        return DraftLine(
            kind="STOCK_ISSUE",
            productId=str(product_id),
            quantity=quantity,
            unitPrice=price,
            basePurchasePrice=source.currentPurchasePrice,
        )

    def project_line(self, row: dict) -> DocumentLine:
        values = {key: value for key, value in row.items() if key != "revisionId"}
        for key in ("id", "productId", "originLineId"):
            if values[key] is not None:
                values[key] = str(values[key])
        return DocumentLine.model_validate(values)

    def get_revision(
        self, identifier: int, number: int, *, check_permission: bool = True
    ) -> Revision:
        document = self.repo.document(identifier, lock=True)
        if check_permission:
            self.authorize_read(document["kind"])
        row = self.repo.revision(identifier, number)
        snapshot = {
            key: row.pop("agency" + key.title()) for key in ("name", "address", "phone", "email")
        }
        row["agencySnapshot"] = snapshot if snapshot["name"] is not None else None
        row["lines"] = [self.project_line(line) for line in self.repo.lines(row["id"])]
        for key in ("id", "documentId", "createdBy", "readyBy", "postedBy"):
            if row[key] is not None:
                row[key] = str(row[key])
        return Revision.model_validate(row)

    def get(self, identifier: int, *, check_permission: bool = True) -> Document:
        row = self.repo.document(identifier, lock=True)
        extras = self.repo.extras(row)
        revision_id = row.pop("currentRevisionId")
        number = self.session.scalar(
            select(REVISION.c.revisionNo).where(REVISION.c.id == revision_id)
        )
        row["currentRevision"] = self.get_revision(
            identifier, number, check_permission=check_permission
        )
        row.pop("creationKey")
        row.pop("businessOrder")
        for key in ("id", "agencyId", "originDocumentId", "createdBy", "cancelledBy"):
            if row[key] is not None:
                row[key] = str(row[key])
        if row["kind"] == "STOCK_ISSUE":
            extras["remainingAtIssue"] = (
                row["currentRevision"].totalAmount - row["currentRevision"].immediatePayment
            )
        return DOCUMENT_MODELS[row["kind"]].model_validate({**row, **extras})

    def etag(self, document: Document) -> str:
        return canonical_etag(f"document:{document.id}", document.model_dump(mode="json"))

    def get_line(self, identifier: int, number: int, line_id: int) -> DocumentLine:
        revision = self.get_revision(identifier, number)
        for line in revision.lines:
            if int(line.id) == line_id:
                return line
        raise ApiError(404, "NOT_FOUND", "Line not found")

    def new_revision(self, identifier: int, business_date: date, reason: str, **values) -> int:
        if not isinstance(reason, str) or not reason.strip():
            raise ApiError(422, "VALIDATION_FAILED", "Revision reason is required")
        return self.repo.new_revision(identifier, business_date, reason, self.actor_id, **values)

    def draft(self, identifier: int, number: int, condition, products):
        document, revision = self.repo.lock_current(identifier)
        if revision["revisionNo"] != number:
            raise ApiError(404, "NOT_FOUND", "Current revision not found")
        if document["kind"] not in PREPARE_PERMISSIONS:
            raise ApiError(409, "LINE_CONFLICT", "Financial-only documents have no goods lines")
        self.authorize((PREPARE_PERMISSIONS[document["kind"]],))
        condition.compare(self.etag(self.get(identifier)))
        if document["status"] != "DRAFT" or revision["state"] != "DRAFT":
            raise ApiError(409, "STATE_CONFLICT", "Only the current draft is editable")
        if not set(self.repo.product_ids(identifier)) <= set(products):
            raise DBAPIError(None, None, SerializationFailure("Document dependencies changed"))
        return document, revision

    def line_values(self, kind: str, body: DraftLine, product: dict) -> dict:
        if body.kind != kind:
            raise ApiError(409, "LINE_CONFLICT", "Line kind does not match document")
        if kind in ("STOCK_RECEIPT", "STOCK_ISSUE") and (
            product["status"] != "ACTIVE" or product["unitStatus"] != "ACTIVE"
        ):
            raise ApiError(409, "INACTIVE_MASTER", "Product or unit is inactive")
        if not product["allowsFraction"] and body.quantity != body.quantity.to_integral_value():
            raise ApiError(409, "INVALID_QUANTITY", "Unit requires an integer quantity")
        if kind != "STOCK_ADJUSTMENT" and (body.quantity <= 0 or body.unitPrice <= 0):
            raise ApiError(409, "LINE_CONFLICT", "Goods quantity and price must be positive")
        if kind == "STOCK_ADJUSTMENT" and body.unitPrice != 0:
            raise ApiError(409, "LINE_CONFLICT", "Adjustment price must be zero")
        if (
            kind == "SALES_RETURN" and (body.originLineId is None or body.returnAmount is None)
        ) or (
            kind != "SALES_RETURN"
            and (body.originLineId is not None or body.returnAmount is not None)
        ):
            raise ApiError(409, "LINE_CONFLICT", "Return provenance does not match kind")
        return {
            **body.model_dump(exclude={"kind"}),
            "productId": int(body.productId),
            "originLineId": None if body.originLineId is None else int(body.originLineId),
            "unitId": product["unitId"],
            "productName": product["name"],
            "unitName": product["unitName"],
        }

    def edit_line(
        self,
        identifier: int,
        number: int,
        body: DraftLine | None,
        condition,
        line_id: int | None = None,
    ):
        identifiers = set(self.repo.product_ids(identifier))
        if body is not None:
            identifiers.add(int(body.productId))
        products = self.repo.lock_products(identifiers, active=False)
        document, revision = self.draft(identifier, number, condition, products)
        lines = self.repo.lines(revision["id"])
        old = next((line for line in lines if line["id"] == line_id), None)
        if line_id is not None and old is None:
            raise ApiError(404, "NOT_FOUND", "Line not found")
        values = None
        amounts = [line["lineAmount"] for line in lines if line["id"] != line_id]
        if body is not None:
            if any(
                line["productId"] == int(body.productId) and line["id"] != line_id for line in lines
            ):
                raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has a line")
            values = self.line_values(document["kind"], body, products[int(body.productId)])
            amounts.append(line_amount(body))
        total = exact_total(amounts)
        if revision["immediatePayment"] > total:
            raise ApiError(409, "LINE_CONFLICT", "Immediate payment exceeds the new total")
        if values is None:
            self.repo.remove_line(line_id)
        else:
            line_id = self.repo.put_line(revision["id"], values, line_id)
        self.repo.set_total(revision["id"], total)
        return None if values is None else self.get_line(identifier, number, line_id)

    def create_line(self, identifier, number, body, condition):
        return self.edit_line(identifier, number, body, condition)

    def replace_line(self, identifier, number, line_id, body, condition):
        return self.edit_line(identifier, number, body, condition, line_id)

    def delete_line(self, identifier, number, line_id, condition) -> None:
        self.edit_line(identifier, number, None, condition, line_id)
