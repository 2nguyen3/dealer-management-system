from datetime import UTC, datetime
from uuid import UUID

from app.common.catalogue import CatalogueService
from app.common.commands import CommandResult, CommandScope
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.modules.agencies.repository import AgencyRepository
from app.modules.agencies.schemas import AgencyListResponse, AgencyResponse, Reason


class AgencyService(CatalogueService):
    repository = AgencyRepository
    response_model = AgencyResponse
    list_model = AgencyListResponse
    permission = "agency.manage"
    operation = "listAgencies"
    search_fields = ("code", "name", "phone", "email", "address")
    sorts = {
        sort: (field,) if field == "id" else (field, "id")
        for field in ("id", "name", "currentDebt", "acceptedDate")
        for sort in (field, "-" + field)
    }
    conflicts = {("23514", "ck_owner_eligible_deletion"): ("RESOURCE_IN_USE", "Agency has usage")}

    def list(self, *, debtFrom=None, debtTo=None, acceptedFrom=None, acceptedTo=None, **filters):
        if debtFrom is not None and debtTo is not None and debtFrom > debtTo:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid debt interval")
        if acceptedFrom is not None and acceptedTo is not None and acceptedFrom >= acceptedTo:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid accepted-date interval")
        return super().list(
            debtFrom=debtFrom,
            debtTo=debtTo,
            acceptedFrom=acceptedFrom,
            acceptedTo=acceptedTo,
            **filters,
        )

    def create(self, body):
        def work():
            values = {**body.model_dump(), "createdBy": self.actor_id, "updatedBy": self.actor_id}
            self.repo.prepare_create(values)
            self.authorize((self.permission,))
            identifier = self.repo.create(values)
            return lambda: self.get(identifier)

        return self.write(work)

    def validate_update(self, row, values):
        super().validate_update(row, values)
        values["updatedBy"] = self.actor_id

    def terminate(self, identifier: int, body: Reason, condition: Preconditions, key: UUID):
        def authorize():
            set_audit_context(
                self.session, self.actor_id, self.request_id, function_code=self.permission
            )
            self.authorize((self.permission,))

        def work(command):
            row = self.repo.lock(identifier)
            if row is None:
                raise ApiError(404, "NOT_FOUND", "Agency not found")
            self.authorize((self.permission,))
            condition.compare(self.etag(self.get(identifier)))
            if row.status != "ACTIVE":
                raise ApiError(409, "STATE_CONFLICT", "Agency is already terminated")
            self.repo.update(
                identifier,
                {
                    "status": "TERMINATED",
                    "terminatedAt": datetime.now(UTC),
                    "terminationReason": body.reason,
                    "updatedBy": self.actor_id,
                },
            )

            def project():
                item = self.get(identifier)
                return CommandResult(
                    status=200, body=item.model_dump(mode="json"), headers={"ETag": self.etag(item)}
                )

            return project

        return TransactionRunner(self.session).run(
            CommandScope(self.actor_id, "terminateAgency", f"agency:{identifier}", key),
            body.model_dump(),
            authorize=authorize,
            work=work,
            conflicts=self.conflicts,
        )
