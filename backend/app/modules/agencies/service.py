from datetime import UTC, datetime

from app.common.catalogue import CatalogueService
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
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
        for field in ("id", "name", "debt", "acceptedDate")
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

    def terminate(self, identifier: int, body: Reason, condition: Preconditions):
        def work():
            row = self.repo.lock(identifier)
            if row is None:
                raise ApiError(404, "NOT_FOUND", "Agency not found")
            self.authorize((self.permission,))
            condition.compare(self.etag(self.get(identifier)))
            if row.status != "ACTIVE":
                raise ApiError(409, "STATE_CONFLICT", "Agency is already terminated")
            if row.debt != 0:
                # QĐ6 forbids new documents for a terminated agency, so settle debt first.
                raise ApiError(
                    409,
                    "AGENCY_HAS_DEBT",
                    "Settle the agency debt before terminating it",
                    details={"debt": str(row.debt)},
                )
            self.repo.update(
                identifier,
                {
                    "status": "TERMINATED",
                    "terminatedAt": datetime.now(UTC),
                    "terminationReason": body.reason,
                    "updatedBy": self.actor_id,
                },
            )
            return lambda: self.get(identifier)

        return self.write(work)
