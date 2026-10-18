from sqlalchemy import text

from app.common.commands import internal_substep_key
from app.core.exceptions import ApiError
from app.modules.document_core.financial import FinancialDocumentService
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.payment_receipts.repository import PaymentReceiptRepository


class PaymentReceiptService(FinancialDocumentService):
    repository = PaymentReceiptRepository
    kind = "PAYMENT_RECEIPT"
    permission = "cash.receipt.prepare"
    operation = "listPaymentReceipts"

    def create_internal(
        self, agency, day, amount, method, key, *, receipt_type, origin=None, note=None
    ):
        """No commit: caller owns evidence, locks, permission and final constraints."""
        self.check_date(agency, day)
        return self.core.create_draft(
            self.kind,
            day,
            key,
            agencyId=agency["id"],
            receiptType=receipt_type,
            originDocumentId=origin,
            totalAmount=amount,
            paymentMethod=method,
            note=note,
        )

    def create(self, body, key):
        def work(command):
            agency = self.lock_agency(int(body.agencyId), self.permission)
            identifier = self.create_internal(
                agency,
                body.businessDate,
                body.amount,
                body.paymentMethod,
                internal_substep_key(command.id, "receipt"),
                receipt_type="DEBT_COLLECTION",
                note=body.note,
            )
            return lambda: self.result(
                identifier, status=201, location=f"/api/v1/payment-receipts/{identifier}"
            )

        return self.command(
            "createPaymentReceipt",
            "payment-receipts",
            key,
            body.model_dump(),
            self.permission,
            work,
        )

    def lock_manual_draft(self, identifier, condition, permission):
        source = self.source(identifier)
        agency = self.lock_agency(source["agencyId"], permission)
        self.settlement.repo.lock_history(agency["id"])
        document, revision = self.core.repo.lock_current(identifier)
        self.authorize((permission,))
        condition.compare(self.etag(self.core.get(identifier, check_permission=False)))
        if (
            document["status"] != "DRAFT"
            or revision["state"] != "DRAFT"
            or document["receiptType"] != "DEBT_COLLECTION"
            or revision["paymentMethod"] not in ("CASH", "BANK_TRANSFER")
        ):
            raise ApiError(
                409, "RECEIPT_CONFLICT", "Only a manual debt-collection draft is editable"
            )
        return document, revision, agency

    def update(self, identifier, body, condition):
        def work():
            _, revision, agency = self.lock_manual_draft(identifier, condition, self.permission)
            values = {name: getattr(body, name) for name in body.model_fields_set}
            self.check_date(agency, values.get("businessDate", revision["businessDate"]))
            if "amount" in values:
                values["totalAmount"] = values.pop("amount")
            self.session.execute(
                REVISION.update().where(REVISION.c.id == revision["id"]).values(**values)
            )
            return lambda: self.get(identifier)

        return self.write(work)

    def post(self, identifier, condition, key):
        def work(command):
            self.lock_manual_draft(identifier, condition, "cash.receipt.post")
            self.settlement.post_receipt(identifier, command.id)
            return lambda: self.result(identifier)

        return self.command(
            "postPaymentReceipt",
            f"payment-receipt:{identifier}",
            key,
            {},
            "cash.receipt.post",
            work,
        )

    def cancel_draft(self, identifier, reason, condition, key):
        def work(command):
            self.lock_manual_draft(identifier, condition, "documents.cancel")
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
            "cancelPaymentReceipt",
            f"payment-receipt:{identifier}",
            key,
            reason.model_dump(),
            "documents.cancel",
            work,
        )
