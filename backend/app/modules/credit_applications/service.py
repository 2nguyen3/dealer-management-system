from sqlalchemy import text

from app.common.commands import internal_substep_key
from app.core.exceptions import ApiError
from app.modules.agency_credit.service import AvailableCreditService
from app.modules.credit_applications.repository import CreditApplicationRepository
from app.modules.document_core.financial import FinancialDocumentService
from app.modules.document_core.models import DOCUMENT, REVISION


class CreditApplicationService(FinancialDocumentService):
    repository = CreditApplicationRepository
    kind = "CREDIT_APPLICATION"
    permission = "credit.apply"
    operation = "listCreditApplications"

    def create(self, body, key):
        def work(command):
            agency = self.lock_agency(int(body.agencyId), self.permission)
            self.check_date(agency, body.businessDate)
            identifier = self.core.create_draft(
                self.kind,
                body.businessDate,
                internal_substep_key(command.id, "credit-application"),
                agencyId=agency["id"],
                totalAmount=body.amount,
                note=body.note,
            )
            return lambda: self.result(
                identifier, status=201, location=f"/api/v1/credit-applications/{identifier}"
            )

        return self.command(
            "createCreditApplication",
            "credit-applications",
            key,
            body.model_dump(),
            self.permission,
            work,
        )

    def lock_draft(self, identifier, condition, permission):
        source = self.source(identifier)
        agency = self.lock_agency(source["agencyId"], permission)
        self.settlement.repo.lock_history(agency["id"])
        document, revision = self.core.repo.lock_current(identifier)
        self.authorize((permission,))
        condition.compare(self.etag(self.core.get(identifier, check_permission=False)))
        if document["status"] != "DRAFT" or revision["state"] != "DRAFT":
            raise ApiError(
                409, "STATE_CONFLICT", "Only a current credit-application draft is editable"
            )
        return document, revision, agency

    def update(self, identifier, body, condition):
        def work():
            _, revision, agency = self.lock_draft(identifier, condition, self.permission)
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
            _, revision, agency = self.lock_draft(identifier, condition, self.permission)
            self.check_date(agency, revision["businessDate"])
            # Shared availability acquires the same writer locks. Its current values
            # cannot reject a valid backdated application: replay checks the complete
            # historical timeline, including reservations and later consumption.
            AvailableCreditService(
                self.session, self.actor_id, self.request_id, self.authorize
            ).available(agency["id"], permission=self.permission)
            self.session.execute(
                REVISION.update()
                .where(REVISION.c.id == revision["id"])
                .values(
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
                revision["id"], "POST", internal_substep_key(command.id, "post"), self.actor_id
            )
            self.settlement.replay(agency["id"], command.id, permission=self.permission)
            return lambda: self.result(identifier)

        return self.command(
            "postCreditApplication",
            f"credit-application:{identifier}",
            key,
            {},
            self.permission,
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
            "cancelCreditApplication",
            f"credit-application:{identifier}",
            key,
            reason.model_dump(),
            "documents.cancel",
            work,
        )
