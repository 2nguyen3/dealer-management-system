from datetime import date
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.document_core.models import BATCH, DOCUMENT, LINE, REVISION


class DocumentRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def document(self, identifier: int, *, lock: bool = False, write: bool = False):
        query = select(DOCUMENT).where(DOCUMENT.c.id == identifier)
        if lock:
            query = query.with_for_update(read=not write)
        row = self.session.execute(query).mappings().one_or_none()
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Document not found")
        return dict(row)

    def revision(self, identifier: int, number: int):
        row = (
            self.session.execute(
                select(REVISION).where(
                    REVISION.c.documentId == identifier, REVISION.c.revisionNo == number
                )
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Revision not found")
        return dict(row)

    def lines(self, revision_id: int):
        return [
            dict(row)
            for row in self.session.execute(
                select(LINE).where(LINE.c.revisionId == revision_id).order_by(LINE.c.lineNo)
            ).mappings()
        ]

    def create_draft(
        self, kind: str, business_date: date, creation_key: UUID, actor: int, **values
    ) -> int:
        identifier = self.session.scalar(
            DOCUMENT.insert()
            .values(
                kind=kind,
                creationKey=creation_key,
                createdBy=actor,
                **{
                    key: values.pop(key)
                    for key in ("agencyId", "originDocumentId", "receiptType")
                    if key in values
                },
            )
            .returning(DOCUMENT.c.id)
        )
        revision_id = self.session.scalar(
            REVISION.insert()
            .values(
                documentId=identifier,
                revisionNo=1,
                businessDate=business_date,
                createdBy=actor,
                **values,
            )
            .returning(REVISION.c.id)
        )
        self.session.execute(
            DOCUMENT.update()
            .where(DOCUMENT.c.id == identifier)
            .values(currentRevisionId=revision_id)
        )
        return identifier

    def product_ids(self, identifier: int) -> tuple[int, ...]:
        return tuple(
            self.session.scalars(
                select(LINE.c.productId)
                .join(REVISION, REVISION.c.id == LINE.c.revisionId)
                .join(DOCUMENT, DOCUMENT.c.currentRevisionId == REVISION.c.id)
                .where(DOCUMENT.c.id == identifier)
                .order_by(LINE.c.productId)
            )
        )

    def lock_products(self, identifiers, *, active: bool = True) -> dict[int, dict]:
        self.session.execute(text("SELECT id FROM dms.business_rule WHERE id FOR SHARE"))
        products = {}
        # M11 policy writers take product before unit; preserve that order.
        for identifier in sorted(set(identifiers)):
            row = (
                self.session.execute(
                    text('SELECT id,name,"unitId",status FROM dms.product WHERE id=:id FOR SHARE'),
                    {"id": identifier},
                )
                .mappings()
                .one_or_none()
            )
            if row is None:
                raise ApiError(404, "NOT_FOUND", "Product not found")
            products[identifier] = dict(row)
        for identifier in sorted({row["unitId"] for row in products.values()}):
            unit = (
                self.session.execute(
                    text(
                        'SELECT id,name,status,"allowsFraction" FROM dms.unit '
                        "WHERE id=:id FOR SHARE"
                    ),
                    {"id": identifier},
                )
                .mappings()
                .one()
            )
            for product in products.values():
                if product["unitId"] == identifier:
                    product.update(
                        unitName=unit["name"],
                        unitStatus=unit["status"],
                        allowsFraction=unit["allowsFraction"],
                    )
                    if active and (product["status"] != "ACTIVE" or unit["status"] != "ACTIVE"):
                        raise ApiError(409, "INACTIVE_MASTER", "Product or unit is inactive")
        return products

    def lock_current(self, identifier: int):
        document = self.document(identifier, lock=True, write=True)
        revision = dict(
            self.session.execute(
                select(REVISION)
                .where(REVISION.c.id == document["currentRevisionId"])
                .with_for_update()
            )
            .mappings()
            .one()
        )
        return document, revision

    def new_revision(
        self, identifier: int, business_date: date, reason: str, actor: int, **values
    ) -> int:
        self.document(identifier, lock=True, write=True)
        number = (
            self.session.scalar(
                select(func.max(REVISION.c.revisionNo)).where(REVISION.c.documentId == identifier)
            )
            + 1
        )
        return self.session.scalar(
            REVISION.insert()
            .values(
                documentId=identifier,
                revisionNo=number,
                businessDate=business_date,
                reason=reason,
                createdBy=actor,
                **values,
            )
            .returning(REVISION.c.id)
        )

    def put_line(self, revision_id: int, values: dict, line_id: int | None = None) -> int:
        if line_id is None:
            number = (
                self.session.scalar(
                    select(func.coalesce(func.max(LINE.c.lineNo), 0)).where(
                        LINE.c.revisionId == revision_id
                    )
                )
                + 1
            )
            return self.session.scalar(
                LINE.insert()
                .values(revisionId=revision_id, lineNo=number, **values)
                .returning(LINE.c.id)
            )
        self.session.execute(LINE.update().where(LINE.c.id == line_id).values(**values))
        return line_id

    def remove_line(self, line_id: int) -> None:
        self.session.execute(LINE.delete().where(LINE.c.id == line_id))

    def set_total(self, revision_id: int, amount) -> None:
        self.session.execute(
            REVISION.update().where(REVISION.c.id == revision_id).values(totalAmount=amount)
        )

    def append_batch(self, revision_id: int, kind: str, key: UUID, actor: int) -> int:
        if kind not in ("POST", "REVERSE", "REALLOCATE"):
            raise ValueError("Invalid batch kind")
        return self.session.scalar(
            BATCH.insert()
            .values(
                revisionId=revision_id,
                kind=kind,
                idempotencyKey=key,
                createdBy=actor,
            )
            .returning(BATCH.c.id)
        )

    def extras(self, document: dict) -> dict:
        identifier, revision_id = document["id"], document["currentRevisionId"]
        kind = document["kind"]
        if kind == "STOCK_ISSUE":
            invoice = (
                self.session.execute(
                    text('SELECT * FROM dms.invoice_balance WHERE "issueDocumentId"=:id'),
                    {"id": identifier},
                )
                .mappings()
                .one_or_none()
            )
            return {
                "invoiceBalance": None
                if invoice is None
                else {
                    **invoice,
                    "issueDocumentId": str(invoice["issueDocumentId"]),
                    "agencyId": str(invoice["agencyId"]),
                },
                "upfrontConfirmationId": self.session.scalar(
                    text(
                        'SELECT id::text FROM dms.upfront_confirmation WHERE "issueRevisionId"=:id'
                    ),
                    {"id": revision_id},
                ),
                "autoReceiptId": self.session.scalar(
                    text(
                        'SELECT id::text FROM dms.document WHERE "originDocumentId"=:id '
                        "AND \"receiptType\"='AUTO_FROM_ISSUE'"
                    ),
                    {"id": identifier},
                ),
            }
        if kind in ("PAYMENT_RECEIPT", "SALES_RETURN", "CREDIT_APPLICATION", "REFUND"):
            sums = (
                self.session.execute(
                    text("""
                SELECT -coalesce((SELECT sum(e.amount) FROM dms.receivable_entry e
                  JOIN dms.posting_batch b ON b.id=e."batchId"
                    WHERE b."revisionId"=:id AND e.kind<>'CHARGE'),0) AS applied,
                  coalesce((SELECT sum(e.amount) FROM dms.credit_entry e
                    JOIN dms.posting_batch b ON b.id=e."batchId"
                    WHERE b."revisionId"=:id AND e.kind='CREATED'),0) AS created,
                  -coalesce((SELECT sum(e.amount) FROM dms.credit_entry e
                    JOIN dms.posting_batch b ON b.id=e."batchId"
                    WHERE b."revisionId"=:id AND e.kind<>'CREATED'),0) AS used
            """),
                    {"id": revision_id},
                )
                .mappings()
                .one()
            )
            if kind == "PAYMENT_RECEIPT":
                return {
                    "appliedAmount": sums["applied"],
                    "creditCreatedAmount": sums["created"],
                    "onlinePaymentId": self.session.scalar(
                        text(
                            'SELECT id::text FROM dms.online_payment WHERE "receiptDocumentId"=:id'
                        ),
                        {"id": identifier},
                    ),
                }
            if kind == "SALES_RETURN":
                return {
                    "debtReducedAmount": sums["applied"],
                    "creditCreatedAmount": sums["created"],
                }
            if kind == "CREDIT_APPLICATION":
                return {"cashReceived": "0", "creditUsedAmount": sums["used"]}
            attempt = self.session.execute(
                text(
                    "SELECT id::text,state FROM dms.refund_attempt "
                    'WHERE "refundRevisionId"=:id ORDER BY id DESC LIMIT 1'
                ),
                {"id": revision_id},
            ).one_or_none()
            reserved = self.session.scalar(
                text(
                    "SELECT coalesce(sum(amount),0) FROM dms.refund_reservation "
                    "WHERE \"refundRevisionId\"=:id AND state='ACTIVE'"
                ),
                {"id": revision_id},
            )
            return {
                "reservedAmount": reserved,
                "refundedAmount": sums["used"],
                "latestAttemptId": None if attempt is None else attempt.id,
                "latestAttemptState": None if attempt is None else attempt.state,
            }
        if kind == "STOCK_ADJUSTMENT":
            return {
                "stockCountId": self.session.scalar(
                    text('SELECT id::text FROM dms.stock_count WHERE "adjustmentDocumentId"=:id'),
                    {"id": identifier},
                )
            }
        return {}
