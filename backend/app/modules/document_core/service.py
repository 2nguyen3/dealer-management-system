"""One DocumentService for stock receipts, stock issues and payment receipts.

Posting and cancelling lock the document, then the agency, then the products in
ascending id order, check the business rules (handoff 3.2) against the CURRENT
balances and change ``agency.debt``/``product.stock`` inside the same transaction.
The request transaction is committed here, at the service boundary; repositories
never commit. ``record_online_receipt`` is the only caller-owned-transaction entry.
"""

from __future__ import annotations

from collections.abc import Callable
from decimal import Decimal

from pydantic import BaseModel
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.catalogue import CatalogueService
from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions, canonical_etag
from app.common.schemas import FieldError
from app.common.values import rounded_amount, validate_fraction
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import translate_database_error
from app.modules.document_core.repository import DocumentRepository
from app.modules.document_core.schemas import (
    Document,
    DocumentLine,
    DocumentList,
    DocumentReference,
    DocumentSummary,
)

PERMISSIONS = {
    "STOCK_RECEIPT": ("stock.receipt.prepare", "stock.receipt.post"),
    "STOCK_ISSUE": ("stock.issue.prepare", "stock.issue.post"),
    "PAYMENT_RECEIPT": ("cash.receipt.prepare", "cash.receipt.post"),
}
OPERATIONS = {
    "STOCK_RECEIPT": "listStockReceipts",
    "STOCK_ISSUE": "listStockIssues",
    "PAYMENT_RECEIPT": "listPaymentReceipts",
}
NAMES = {
    "STOCK_RECEIPT": "Stock receipt",
    "STOCK_ISSUE": "Stock issue",
    "PAYMENT_RECEIPT": "Payment receipt",
}
CONFLICTS = {
    ("23514", "ck_product_stock_nonnegative"): ("INSUFFICIENT_STOCK", "Insufficient stock"),
    ("23514", "ck_agency_debt_limit"): ("DEBT_LIMIT_EXCEEDED", "Debt limit exceeded"),
    ("23514", "ck_document_state"): ("STATE_CONFLICT", "Document state does not allow this"),
    ("23514", "ck_document_business_date"): ("VALIDATION_FAILED", "Invalid business date"),
    ("23514", "ck_agency_history_date"): ("VALIDATION_FAILED", "Date precedes agency acceptance"),
    ("23505", "document_replacesDocumentId_key"): ("STATE_CONFLICT", "Document already replaced"),
    # A unit/product change committed while this line waited for its locks.
    ("23514", "ck_document_line_fraction"): (
        "FRACTION_NOT_ALLOWED",
        "Unit does not allow fractional quantities",
    ),
    ("23514", "ck_document_line_unit"): ("MASTER_CONFLICT", "Product unit changed; reload"),
    ("23503", "document_line_productId_fkey"): ("MASTER_CONFLICT", "Product no longer exists"),
    ("23503", "document_agencyId_fkey"): ("MASTER_CONFLICT", "Agency no longer exists"),
}
ETAG_EXCLUDED = {"agencyDebt", "agencyMaxDebt"}


def invalid(field: str, message: str, code: str = "VALIDATION_FAILED") -> ApiError:
    return ApiError(
        422, code, message, fields=[FieldError(field=field, code="invalid", message=message)]
    )


class DocumentService(CatalogueService):
    repository = DocumentRepository
    response_model = DocumentSummary
    list_model = DocumentList
    search_fields = ("code", "note", "agencyName", "agencyCode")
    sorts = {
        sort: (field,) if field == "id" else (field, "id")
        for field in ("id", "businessDate", "totalAmount", "createdAt", "postedAt")
        for sort in (field, "-" + field)
    }

    def __init__(
        self,
        session: Session,
        codec: CursorCodec,
        actor_id: int | None,
        request_id: str,
        authorize: Callable[[tuple[str, ...]], None],
        *,
        kind: str,
        embedded: bool = False,
    ) -> None:
        super().__init__(session, codec, actor_id, request_id, authorize)
        # Embedded mode (seed): each operation runs in a savepoint of the caller's
        # transaction, nothing is committed and mutations return the document id.
        self.embedded = embedded
        if kind not in PERMISSIONS:
            raise ValueError("Unknown document kind")
        self.kind = kind
        self.repo = DocumentRepository(session, kind)
        self.prepare_permission, self.post_permission = PERMISSIONS[kind]
        self.operation = OPERATIONS[kind]

    # ----------------------------------------------------------- reads ----

    def list(self, *, fromDate=None, toDate=None, sort="-businessDate", **filters):
        if fromDate is not None and toDate is not None and fromDate >= toDate:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid business-date interval")
        return super().list(fromDate=fromDate, toDate=toDate, sort=sort, **filters)

    def get(self, identifier: int) -> Document:
        row = self.repo.document(identifier)
        if row is None or row["kind"] != self.kind:
            raise ApiError(404, "NOT_FOUND", f"{NAMES[self.kind]} not found")
        return self.project(row)

    def project(self, row) -> Document:
        def ident(value):
            return None if value is None else str(value)

        def reference(prefix_id, code, status):
            if prefix_id is None:
                return None
            return DocumentReference(id=str(prefix_id), code=code, status=status)

        values = {
            key: row[key]
            for key in (
                "code",
                "kind",
                "status",
                "businessDate",
                "agencyCode",
                "agencyName",
                "receiptType",
                "totalAmount",
                "sellingPriceRate",
                "note",
                "lineCount",
                "createdByName",
                "postedByName",
                "postedAt",
                "cancelledByName",
                "cancelledAt",
                "cancelReason",
                "createdAt",
                "updatedAt",
                "agencyDebt",
                "agencyMaxDebt",
            )
        }
        for key in (
            "agencyId",
            "replacesDocumentId",
            "replacedByDocumentId",
            "createdBy",
            "postedBy",
            "cancelledBy",
            "onlinePaymentId",
        ):
            values[key] = ident(row[key])
        lines = [
            DocumentLine(
                **{
                    **dict(line),
                    "id": str(line["id"]),
                    "productId": str(line["productId"]),
                }
            )
            for line in self.repo.lines(row["id"])
        ]
        return Document(
            id=str(row["id"]),
            replaces=reference(
                row["replacesDocumentId"], row["replacesCode"], row["replacesStatus"]
            ),
            replacedBy=reference(
                row["replacedByDocumentId"], row["replacedByCode"], row["replacedByStatus"]
            ),
            lines=lines,
            **values,
        )

    def etag(self, item: BaseModel) -> str:
        projection = item.model_dump(mode="json", exclude=ETAG_EXCLUDED)
        return canonical_etag(f"document:{item.id}", projection)

    # ------------------------------------------------------ transaction ----

    def transaction(self, function_code: str, permissions: tuple[str, ...], work):
        """Run one request transaction under the audit function, then return the result."""
        if self.embedded:
            savepoint = self.session.begin_nested()
            try:
                set_audit_context(
                    self.session, self.actor_id, self.request_id, function_code=function_code
                )
                self.authorize(permissions)
                identifier = work()
                self.session.flush()
            except DBAPIError as error:
                savepoint.rollback()
                raise translate_database_error(error, CONFLICTS) from None
            except Exception:
                savepoint.rollback()
                raise
            savepoint.commit()
            return identifier
        try:
            set_audit_context(
                self.session, self.actor_id, self.request_id, function_code=function_code
            )
            self.authorize(permissions)
            identifier = work()
            self.session.flush()
            self.session.commit()
        except DBAPIError as error:
            self.session.rollback()
            raise translate_database_error(error, CONFLICTS) from None
        except Exception:
            self.session.rollback()
            raise
        return identifier

    def result(self, identifier: int):
        return identifier if self.embedded else self.get(identifier)

    def locked(self, identifier: int, preconditions: Preconditions | None, *, status: str):
        row = self.repo.lock_document(identifier)
        if row is None or row["kind"] != self.kind:
            raise ApiError(404, "NOT_FOUND", f"{NAMES[self.kind]} not found")
        if row["status"] != status:
            raise ApiError(
                409,
                "STATE_CONFLICT",
                f"{NAMES[self.kind]} is {row['status']}, expected {status}",
                details={"status": row["status"]},
            )
        if preconditions is not None:
            preconditions.compare(self.etag(self.get(identifier)))
        return row

    # ------------------------------------------------------ validation ----

    def business_date(self, value, *, today):
        if value is None:
            return today
        if value > today:
            raise invalid("businessDate", "Business date cannot be in the future")
        return value

    def check_period(self, business_date, today) -> None:
        """QĐ8: only documents dated in the current month may be cancelled or corrected."""
        if (business_date.year, business_date.month) != (today.year, today.month):
            raise ApiError(
                409,
                "PERIOD_CLOSED",
                "Documents of a closed month cannot be cancelled or corrected",
                details={"businessDate": business_date.isoformat()},
            )

    def usable_agency(self, agency_id: int, business_date, *, lock=False, allow_terminated=False):
        agency = self.repo.agency(agency_id, lock=lock)
        if agency is None:
            raise ApiError(404, "NOT_FOUND", "Agency not found")
        if agency["status"] != "ACTIVE" and not allow_terminated:
            raise ApiError(409, "AGENCY_TERMINATED", "Agency is terminated")
        if business_date is not None and business_date < agency["acceptedDate"]:
            raise invalid("businessDate", "Business date precedes agency acceptance")
        return agency

    def usable_product(self, product, product_id):
        if product is None:
            raise ApiError(
                404, "NOT_FOUND", "Product not found", details={"productId": str(product_id)}
            )
        if product["status"] != "ACTIVE" or product["unitStatus"] != "ACTIVE":
            raise ApiError(
                409,
                "INACTIVE_MASTER",
                "Product or unit is inactive",
                details={"productId": str(product_id)},
            )
        return product

    def quote(self, product, rate) -> Decimal:
        """QĐ2: selling price = round(last purchase price × selling-price rate)."""
        if product["lastPurchasePrice"] is None:
            raise ApiError(
                409,
                "PRODUCT_NOT_PRICED",
                "Product has never been received and cannot be issued",
                details={"productId": str(product["id"]), "productName": product["name"]},
            )
        return rounded_amount(Decimal(product["lastPurchasePrice"]), Decimal(rate))

    def prepared_lines(self, body) -> list[dict]:
        identifiers = [int(line.productId) for line in body.lines]
        if len(set(identifiers)) != len(identifiers):
            raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has a line")
        products = self.repo.products(identifiers)
        rate = self.repo.selling_rate() if self.kind == "STOCK_ISSUE" else None
        lines = []
        for line in body.lines:
            product = self.usable_product(products.get(int(line.productId)), line.productId)
            try:
                validate_fraction(line.quantity, allows_fraction=product["allowsFraction"])
            except ValueError:
                raise ApiError(
                    409,
                    "FRACTION_NOT_ALLOWED",
                    "Unit does not allow fractional quantities",
                    details={"productId": line.productId},
                ) from None
            price = line.unitPrice if self.kind == "STOCK_RECEIPT" else self.quote(product, rate)
            lines.append(
                {
                    "productId": product["id"],
                    "unitId": product["unitId"],
                    "productName": product["name"],
                    "unitName": product["unitName"],
                    "quantity": line.quantity,
                    "unitPrice": price,
                }
            )
        return lines

    def content(self, body, *, today, agency_id=None) -> tuple[dict, list[dict]]:
        """Validated document header values and lines of a draft or a correction."""
        business_date = self.business_date(body.businessDate, today=today)
        values = {"businessDate": business_date, "note": body.note}
        lines: list[dict] = []
        if self.kind != "STOCK_RECEIPT":
            agency = int(agency_id if agency_id is not None else body.agencyId)
            self.usable_agency(agency, business_date)
            values["agencyId"] = agency
        if self.kind == "PAYMENT_RECEIPT":
            values["receiptType"] = body.receiptType
            values["totalAmount"] = body.amount
        else:
            lines = self.prepared_lines(body)
            values["totalAmount"] = sum(
                (rounded_amount(line["quantity"], line["unitPrice"]) for line in lines), Decimal(0)
            )
        return values, lines

    # ---------------------------------------------------- draft writes ----

    def create(self, body) -> Document:
        def work():
            values, lines = self.content(body, today=self.repo.today())
            identifier = self.repo.insert_document(
                {"kind": self.kind, "createdBy": self.actor_id, **values}
            )
            self.repo.replace_lines(identifier, lines)
            return identifier

        identifier = self.transaction(self.prepare_permission, (self.prepare_permission,), work)
        return self.result(identifier)

    def replace(self, identifier: int, body, preconditions: Preconditions) -> Document:
        def work():
            self.locked(identifier, preconditions, status="DRAFT")
            values, lines = self.content(body, today=self.repo.today())
            self.repo.update_document(identifier, values)
            self.repo.replace_lines(identifier, lines)
            return identifier

        self.transaction(self.prepare_permission, (self.prepare_permission,), work)
        return self.result(identifier)

    def delete(self, identifier: int, preconditions: Preconditions) -> None:
        def work():
            self.locked(identifier, preconditions, status="DRAFT")
            self.repo.delete_document(identifier)
            return identifier

        self.transaction(self.prepare_permission, (self.prepare_permission,), work)

    # ---------------------------------------------------------- effects ----

    def apply_post(self, document, *, online: bool = False) -> None:
        """Check QĐ2–QĐ6 against current balances and apply the posting effects."""
        identifier = document["id"]
        today = self.repo.today()
        if document["businessDate"] > today:
            raise invalid("businessDate", "Business date cannot be in the future")
        if self.kind == "PAYMENT_RECEIPT":
            agency = self.usable_agency(
                document["agencyId"], None, lock=True, allow_terminated=online
            )
            amount = Decimal(document["totalAmount"])
            if amount <= 0:
                raise invalid("amount", "Amount must be positive")
            # QĐ4; a verified online payment is real money and is always recorded (3.3).
            if not online and amount > agency["debt"]:
                raise ApiError(
                    409,
                    "PAYMENT_EXCEEDS_DEBT",
                    "Payment exceeds the current debt",
                    details={"debt": str(agency["debt"]), "amount": str(amount)},
                )
            self.repo.change_debt(agency["id"], -amount)
            self.repo.mark_posted(identifier, self.actor_id, amount)
            return

        agency = None
        if self.kind == "STOCK_ISSUE":
            agency = self.usable_agency(document["agencyId"], document["businessDate"], lock=True)
        lines = self.repo.raw_lines(identifier)
        if not lines:
            raise ApiError(409, "EMPTY_DOCUMENT", "Document has no lines")
        products = self.repo.products([line["productId"] for line in lines], lock=True)
        for line in lines:
            self.usable_product(products.get(line["productId"]), line["productId"])

        if self.kind == "STOCK_RECEIPT":
            total = sum((Decimal(line["lineAmount"]) for line in lines), Decimal(0))
            for line in lines:
                self.repo.change_stock(
                    line["productId"], line["quantity"], line["unitPrice"], set_price=True
                )
            self.repo.mark_posted(identifier, self.actor_id, total)
            return

        rate = self.repo.selling_rate()
        total = Decimal(0)
        for line in lines:
            product = products[line["productId"]]
            price = self.quote(product, rate)
            if line["quantity"] > product["stock"]:
                raise ApiError(
                    409,
                    "INSUFFICIENT_STOCK",
                    "Issued quantity exceeds current stock",
                    details={
                        "productId": str(product["id"]),
                        "productName": product["name"],
                        "available": str(product["stock"]),
                        "requested": str(line["quantity"]),
                    },
                )
            if price != line["unitPrice"]:
                self.repo.set_line_price(line["id"], price)
            total += rounded_amount(Decimal(line["quantity"]), price)
        debt_after = Decimal(agency["debt"]) + total
        if debt_after > agency["maxDebt"]:
            raise ApiError(
                409,
                "DEBT_LIMIT_EXCEEDED",
                "Debt after this issue exceeds the agency type limit",
                details={
                    "debt": str(agency["debt"]),
                    "maxDebt": str(agency["maxDebt"]),
                    "totalAmount": str(total),
                },
            )
        for line in lines:
            self.repo.change_stock(line["productId"], -Decimal(line["quantity"]))
        self.repo.change_debt(agency["id"], total)
        self.repo.mark_posted(identifier, self.actor_id, total, rate)

    def apply_cancel(self, document, reason: str) -> None:
        identifier = document["id"]
        if self.kind == "PAYMENT_RECEIPT":
            self.repo.agency(document["agencyId"], lock=True)
            self.repo.mark_cancelled(identifier, self.actor_id, reason)
            # QĐ7: restoring debt may exceed the limit; it is a correction of a mistake.
            self.repo.change_debt(document["agencyId"], Decimal(document["totalAmount"]))
            return
        if self.kind == "STOCK_ISSUE":
            self.repo.agency(document["agencyId"], lock=True)
        lines = self.repo.raw_lines(identifier)
        products = self.repo.products([line["productId"] for line in lines], lock=True)
        if self.kind == "STOCK_RECEIPT":
            for line in lines:
                product = products[line["productId"]]
                if product["stock"] < line["quantity"]:
                    raise ApiError(
                        409,
                        "INSUFFICIENT_STOCK",
                        "Cancelling this receipt would make stock negative",
                        details={
                            "productId": str(product["id"]),
                            "productName": product["name"],
                            "available": str(product["stock"]),
                            "requested": str(line["quantity"]),
                        },
                    )
            self.repo.mark_cancelled(identifier, self.actor_id, reason)
            for line in lines:
                self.repo.change_stock(line["productId"], -Decimal(line["quantity"]))
                self.repo.set_purchase_price(
                    line["productId"], self.repo.latest_purchase_price(line["productId"])
                )
            return
        self.repo.mark_cancelled(identifier, self.actor_id, reason)
        for line in lines:
            self.repo.change_stock(line["productId"], Decimal(line["quantity"]))
        self.repo.change_debt(document["agencyId"], -Decimal(document["totalAmount"]))

    # ---------------------------------------------------- posted writes ----

    def post(self, identifier: int, preconditions: Preconditions) -> Document:
        def work():
            document = self.locked(identifier, preconditions, status="DRAFT")
            self.apply_post(document)
            return identifier

        self.transaction(self.post_permission, (self.post_permission,), work)
        return self.result(identifier)

    def reason(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise invalid("reason", "A reason is required", code="REASON_REQUIRED")
        return value

    def cancellable(self, document, today) -> None:
        if document["receiptType"] == "ONLINE":
            raise ApiError(
                409, "STATE_CONFLICT", "Online receipts are confirmed by the provider and are final"
            )
        self.check_period(document["businessDate"], today)

    def cancel(self, identifier: int, reason: str, preconditions: Preconditions) -> Document:
        reason = self.reason(reason)

        def work():
            document = self.locked(identifier, preconditions, status="POSTED")
            self.cancellable(document, self.repo.today())
            self.apply_cancel(document, reason)
            return identifier

        self.transaction("documents.cancel", ("documents.cancel",), work)
        return self.result(identifier)

    def correct(self, identifier: int, body, preconditions: Preconditions) -> Document:
        """D7: cancel the posted document and post its replacement in one transaction."""
        reason = self.reason(body.reason)

        def work():
            old = self.locked(identifier, preconditions, status="POSTED")
            today = self.repo.today()
            self.cancellable(old, today)
            values, lines = self.content(body, today=today, agency_id=old["agencyId"])
            if body.businessDate is None:
                values["businessDate"] = old["businessDate"]
            self.check_period(values["businessDate"], today)
            replacement = self.repo.insert_document(
                {
                    "kind": self.kind,
                    "createdBy": self.actor_id,
                    "replacesDocumentId": identifier,
                    **values,
                }
            )
            self.repo.replace_lines(replacement, lines)
            draft = self.repo.lock_document(replacement)
            # Receipts add the new stock first; issues and payments release the old effect
            # first. Either way stock never dips below zero inside the transaction.
            if self.kind == "STOCK_RECEIPT":
                self.apply_post(draft)
                self.apply_cancel(old, reason)
            else:
                self.apply_cancel(old, reason)
                self.apply_post(draft)
            return replacement

        replacement = self.transaction(
            "documents.correct", ("documents.correct", self.post_permission), work
        )
        return self.result(replacement)

    # ------------------------------------------------- online payments ----

    def record_online_receipt(
        self,
        agency_id: int,
        amount: Decimal,
        *,
        business_date=None,
        note: str | None = None,
        created_by: int | None = None,
    ) -> int:
        """Post an ONLINE payment receipt inside the caller's transaction (VNPAY IPN).

        The caller owns commit/rollback and the audit context (payments.online).
        """
        set_audit_context(
            self.session, self.actor_id, self.request_id, function_code="payments.online"
        )
        business_date = business_date or self.repo.today()
        identifier = self.repo.insert_document(
            {
                "kind": "PAYMENT_RECEIPT",
                "agencyId": agency_id,
                "receiptType": "ONLINE",
                "businessDate": business_date,
                "totalAmount": amount,
                "note": note,
                "createdBy": created_by,
            }
        )
        self.apply_post(self.repo.lock_document(identifier), online=True)
        return identifier
