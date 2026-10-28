import json

from sqlalchemy import text

from app.common.commands import internal_substep_key
from app.common.dates import vietnam_date
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.modules.document_core.financial import FinancialDocumentService
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.refunds.repository import RefundRepository
from app.modules.settlement_core.reservations import ReservationService


class RefundService(FinancialDocumentService):
    repository = RefundRepository
    kind = "REFUND"
    permission = "cash.refund.prepare"
    operation = "listRefunds"

    def source_receipt(self, identifier, permission, method):
        source = self.settlement.repo.source(identifier)
        if source["kind"] != "PAYMENT_RECEIPT" or source["status"] != "POSTED":
            raise ApiError(409, "REFUND_SOURCE_CONFLICT", "Refund requires a posted cash receipt")
        agency = self.lock_agency(source["agencyId"], permission)
        self.settlement.repo.lock_history(agency["id"])
        self.authorize((permission,))
        source = self.settlement.repo.source(identifier)
        if source["status"] != "POSTED":
            raise ApiError(409, "REFUND_SOURCE_CONFLICT", "Refund source is no longer posted")
        if method == "ONLINE" and not self.session.scalar(
            text("""
            SELECT EXISTS(SELECT 1 FROM dms.online_payment WHERE "receiptDocumentId"=:id
              AND status='SUCCESS')
        """),
            {"id": identifier},
        ):
            raise ApiError(
                409, "REFUND_SOURCE_CONFLICT", "Online refund requires original successful payment"
            )
        return source, agency

    def create(self, body, key):
        def work(command):
            source, agency = self.source_receipt(
                int(body.originDocumentId), self.permission, body.paymentMethod
            )
            self.check_date(agency, body.businessDate)
            if body.businessDate < source["businessDate"]:
                raise ApiError(409, "REFUND_SOURCE_CONFLICT", "Refund predates source receipt")
            identifier = self.core.create_draft(
                self.kind,
                body.businessDate,
                internal_substep_key(command.id, "refund"),
                agencyId=agency["id"],
                originDocumentId=source["id"],
                totalAmount=body.amount,
                paymentMethod=body.paymentMethod,
                reason=body.reason,
                note=body.note,
            )
            return lambda: self.result(
                identifier, status=201, location=f"/api/v1/refunds/{identifier}"
            )

        return self.command(
            "createRefund", "refunds", key, body.model_dump(), self.permission, work
        )

    def lock_draft(self, identifier, condition, permission):
        discovered = self.source(identifier)
        source = self.settlement.repo.source(identifier)
        _, agency = self.source_receipt(
            discovered["originDocumentId"], permission, source["paymentMethod"]
        )
        document, revision = self.core.repo.lock_current(identifier)
        self.authorize((permission,))
        condition.compare(self.etag(self.core.get(identifier, check_permission=False)))
        if document["status"] != "DRAFT" or revision["state"] != "DRAFT":
            raise ApiError(409, "STATE_CONFLICT", "Only an unpaid current refund draft is editable")
        return document, revision, agency

    def reservations(self):
        return ReservationService(self.session, self.actor_id, self.request_id, self.authorize)

    def update(self, identifier, body, condition):
        def work():
            document, revision, agency = self.lock_draft(identifier, condition, self.permission)
            if self.settlement.repo.reservations(revision["id"]) or self.session.scalar(
                text(
                    'SELECT EXISTS(SELECT 1 FROM dms.refund_attempt WHERE "refundRevisionId"=:id)'
                ),
                {"id": revision["id"]},
            ):
                raise ApiError(
                    409, "STATE_CONFLICT", "Reserved or attempted refund content is frozen"
                )
            values = {name: getattr(body, name) for name in body.model_fields_set}
            day = values.get("businessDate", revision["businessDate"])
            self.check_date(agency, day)
            source, _ = self.source_receipt(
                document["originDocumentId"],
                self.permission,
                values.get("paymentMethod", revision["paymentMethod"]),
            )
            if day < source["businessDate"]:
                raise ApiError(409, "REFUND_SOURCE_CONFLICT", "Refund predates source receipt")
            if "amount" in values:
                values["totalAmount"] = values.pop("amount")
            self.session.execute(
                REVISION.update().where(REVISION.c.id == revision["id"]).values(**values)
            )
            return lambda: self.get(identifier)

        return self.write(work)

    def submit(self, identifier, condition, key):
        def work(command):
            self.lock_draft(identifier, condition, "cash.refund.post")
            self.reservations().reserve(identifier)
            return lambda: self.result(identifier)

        return self.command(
            "submitRefund", f"refund:{identifier}", key, {}, "cash.refund.post", work
        )

    def post_paid(self, identifier, revision, agency, paid_at, evidence, key):
        day = vietnam_date(paid_at)
        self.check_date(agency, day)
        source = self.settlement.repo.source(self.source(identifier)["originDocumentId"])
        if day < source["businessDate"]:
            raise ApiError(409, "REFUND_SOURCE_CONFLICT", "Payout predates source receipt")
        note = json.dumps(
            {
                "note": revision["note"],
                "paidAt": paid_at.isoformat(),
                "evidenceReference": evidence,
            },
            ensure_ascii=False,
        )
        self.session.execute(
            REVISION.update()
            .where(REVISION.c.id == revision["id"])
            .values(
                businessDate=day,
                note=note,
                state="POSTED",
                postedBy=self.actor_id,
                postedAt=text("clock_timestamp()"),
                **self.snapshot(agency),
            )
        )
        self.session.execute(
            DOCUMENT.update().where(DOCUMENT.c.id == identifier).values(status="POSTED")
        )
        self.core.repo.append_batch(
            revision["id"], "POST", internal_substep_key(key, "refund-post"), self.actor_id
        )
        self.reservations().consume(identifier, key)

    def confirm_paid(self, identifier, body, condition, key):
        def work(command):
            _, revision, agency = self.lock_draft(identifier, condition, "cash.refund.post")
            if revision["paymentMethod"] == "ONLINE":
                raise ApiError(
                    409, "STATE_CONFLICT", "Online refund requires verified provider evidence"
                )
            self.post_paid(
                identifier, revision, agency, body.paidAt, body.evidenceReference, command.id
            )
            return lambda: self.result(identifier)

        return self.command(
            "confirmManualRefundPaid",
            f"refund:{identifier}",
            key,
            body.model_dump(),
            "cash.refund.post",
            work,
        )

    def cancel(self, identifier, reason, condition, key):
        def work(command):
            self.authorize(("documents.cancel", "cash.refund.post"))
            _, revision, _ = self.lock_draft(identifier, condition, "cash.refund.post")
            self.authorize(("documents.cancel", "cash.refund.post"))
            if self.settlement.repo.blocked_attempt(revision["id"]):
                raise ApiError(
                    409, "STATE_CONFLICT", "Unresolved or paid payout cannot be cancelled"
                )
            rows = self.settlement.repo.reservations(revision["id"])
            if any(row["state"] == "ACTIVE" for row in rows):
                self.reservations().release(identifier)
            set_audit_context(
                self.session, self.actor_id, self.request_id, function_code="documents.cancel"
            )
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

        # Live allOf check also applies to recovered results after command claims.
        original = self.authorize

        def authorize(required):
            original(tuple(set(required) | {"documents.cancel", "cash.refund.post"}))

        self.authorize = authorize
        try:
            return self.command(
                "cancelUnpaidRefund",
                f"refund:{identifier}",
                key,
                reason.model_dump(),
                "documents.cancel",
                work,
            )
        finally:
            self.authorize = original
