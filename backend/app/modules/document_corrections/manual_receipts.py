from sqlalchemy import text

from app.common.commands import CommandScope, internal_substep_key
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.modules.document_core.models import DOCUMENT, REVISION


class ManualReceiptCorrectionService:
    """Internal M29 manual cash slice; special real-cash receipts are never editable."""

    def __init__(self, owner):
        self.owner = owner
        self.session, self.core, self.settlement = owner.session, owner.core, owner.settlement

    def run(self, identifier, body, condition, key, *, correcting):
        permission = "documents.correct" if correcting else "documents.cancel"
        required = (permission, "cash.receipt.post") if correcting else (permission,)

        def authorize():
            self.owner.authorize(required)
            set_audit_context(
                self.session, self.owner.actor_id, self.owner.request_id, function_code=permission
            )

        def work(command):
            source = self.owner.source(identifier)
            agency = self.settlement.repo.lock_agency(source["agencyId"])
            self.settlement.repo.lock_history(agency["id"])
            document, revision = self.core.repo.lock_current(identifier)
            authorize()
            if document["receiptType"] != "DEBT_COLLECTION" or revision["paymentMethod"] not in (
                "CASH",
                "BANK_TRANSFER",
            ):
                raise ApiError(
                    409,
                    "RECEIPT_CONFLICT",
                    "Special cash receipts cannot be corrected or cancelled",
                )
            condition.compare(self.owner.etag(self.core.get(identifier, check_permission=False)))
            allowed = ("POSTED",) if correcting else ("DRAFT", "POSTED")
            if document["status"] not in allowed or revision["state"] != document["status"]:
                raise ApiError(409, "STATE_CONFLICT", "Receipt state does not allow this action")
            if correcting:
                self.owner.check_date(agency, body.businessDate)
                successor = self.core.new_revision(
                    identifier,
                    body.businessDate,
                    body.reason,
                    totalAmount=body.amount,
                    paymentMethod=body.paymentMethod,
                    note=body.note,
                    **{
                        name: revision[name]
                        for name in ("agencyName", "agencyAddress", "agencyPhone", "agencyEmail")
                    },
                )
                self.reverse(revision["id"], command.id)
                self.session.execute(
                    DOCUMENT.update()
                    .where(DOCUMENT.c.id == identifier)
                    .values(currentRevisionId=successor)
                )
                self.session.execute(
                    REVISION.update()
                    .where(REVISION.c.id == successor)
                    .values(
                        state="POSTED",
                        postedBy=self.owner.actor_id,
                        postedAt=text("clock_timestamp()"),
                    )
                )
                self.core.repo.append_batch(
                    successor,
                    "POST",
                    internal_substep_key(command.id, "replacement"),
                    self.owner.actor_id,
                )
            else:
                if revision["state"] == "POSTED":
                    self.reverse(revision["id"], command.id)
                self.session.execute(
                    DOCUMENT.update()
                    .where(DOCUMENT.c.id == identifier)
                    .values(
                        status="CANCELLED",
                        cancelledBy=self.owner.actor_id,
                        cancelledAt=text("clock_timestamp()"),
                        cancelReason=body.reason,
                    )
                )
            if revision["state"] == "POSTED":
                self.settlement.replay(agency["id"], command.id, permission=permission)
            authorize()

            def project():
                current = self.core.get(identifier, check_permission=False)
                return self.owner.result(
                    identifier,
                    status=201 if correcting else 200,
                    location=(
                        f"/api/v1/documents/{identifier}/revisions/{current.currentRevision.revisionNo}"
                        if correcting
                        else None
                    ),
                )

            return project

        return TransactionRunner(self.session).run(
            CommandScope(
                self.owner.actor_id,
                "correctPaymentReceipt" if correcting else "cancelPaymentReceipt",
                f"payment-receipt:{identifier}",
                key,
            ),
            body.model_dump(),
            authorize=authorize,
            work=work,
            conflicts={
                ("23514", None): ("CORRECTION_CONFLICT", "Correction violates financial history"),
                ("22003", None): ("BALANCE_OVERFLOW", "Correction exceeds stored balance range"),
            },
        )

    def reverse(self, revision_id, command_id):
        batch = self.core.repo.append_batch(
            revision_id, "REVERSE", internal_substep_key(command_id, "reverse"), self.owner.actor_id
        )
        for ledger in ("receivable", "credit"):
            for entry in self.settlement.repo.effective(revision_id, ledger):
                self.settlement.repo.reverse(batch, ledger, entry)

    def correct(self, identifier, body, condition, key):
        return self.run(identifier, body, condition, key, correcting=True)

    def cancel(self, identifier, body, condition, key):
        return self.run(identifier, body, condition, key, correcting=False)
