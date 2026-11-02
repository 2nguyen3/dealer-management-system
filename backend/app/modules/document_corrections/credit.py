from sqlalchemy import text

from app.common.commands import CommandScope, internal_substep_key
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.modules.document_core.models import DOCUMENT, REVISION


class CreditCorrectionService:
    def __init__(self, owner):
        self.owner, self.session = owner, owner.session
        self.core, self.settlement = owner.core, owner.settlement

    def run(self, identifier, body, condition, key, *, correcting):
        permission = "documents.correct" if correcting else "documents.cancel"
        required = (permission, "credit.apply") if correcting else (permission,)

        def authorize():
            self.owner.authorize(required)
            set_audit_context(
                self.session, self.owner.actor_id, self.owner.request_id, function_code=permission
            )

        def work(command):
            source = self.owner.source(identifier)
            agency = self.settlement.repo.lock_agency(source["agencyId"])
            self.settlement.repo.lock_history(agency["id"])
            document, old = self.core.repo.lock_current(identifier)
            authorize()
            condition.compare(self.owner.etag(self.core.get(identifier, check_permission=False)))
            if document["status"] not in (("POSTED",) if correcting else ("DRAFT", "POSTED")):
                raise ApiError(
                    409, "STATE_CONFLICT", "Credit application state does not allow this action"
                )
            if old["state"] == "POSTED":
                batch = self.core.repo.append_batch(
                    old["id"],
                    "REVERSE",
                    internal_substep_key(command.id, "reverse"),
                    self.owner.actor_id,
                )
                for ledger in ("receivable", "credit"):
                    for entry in self.settlement.repo.effective(old["id"], ledger):
                        self.settlement.repo.reverse(batch, ledger, entry)
            if correcting:
                self.owner.check_date(agency, body.businessDate)
                new = self.core.new_revision(
                    identifier,
                    body.businessDate,
                    body.reason,
                    totalAmount=body.amount,
                    note=body.note,
                    **{
                        name: old[name]
                        for name in ("agencyName", "agencyAddress", "agencyPhone", "agencyEmail")
                    },
                )
                self.session.execute(
                    REVISION.update()
                    .where(REVISION.c.id == new)
                    .values(
                        state="POSTED",
                        postedBy=self.owner.actor_id,
                        postedAt=text("clock_timestamp()"),
                    )
                )
                self.session.execute(
                    DOCUMENT.update()
                    .where(DOCUMENT.c.id == identifier)
                    .values(currentRevisionId=new)
                )
                self.core.repo.append_batch(
                    new,
                    "POST",
                    internal_substep_key(command.id, "replacement"),
                    self.owner.actor_id,
                )
            else:
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
            if old["state"] == "POSTED":
                self.settlement.replay(agency["id"], command.id, permission=permission)
            authorize()

            def project():
                current = self.core.get(identifier, check_permission=False)
                return self.owner.result(
                    identifier,
                    status=201 if correcting else 200,
                    location=f"/api/v1/documents/{identifier}/revisions/{current.currentRevision.revisionNo}"
                    if correcting
                    else None,
                )

            return project

        return TransactionRunner(self.session).run(
            CommandScope(
                self.owner.actor_id,
                "correctCreditApplication" if correcting else "cancelCreditApplication",
                f"credit-application:{identifier}",
                key,
            ),
            body.model_dump(),
            authorize=authorize,
            work=work,
            conflicts={
                ("23514", None): ("CORRECTION_CONFLICT", "Correction violates credit history"),
                ("22003", None): ("BALANCE_OVERFLOW", "Correction exceeds stored balance range"),
            },
        )

    def correct(self, identifier, body, condition, key):
        return self.run(identifier, body, condition, key, correcting=True)

    def cancel(self, identifier, body, condition, key):
        return self.run(identifier, body, condition, key, correcting=False)
