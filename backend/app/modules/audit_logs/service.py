from app.common.catalogue import CatalogueService
from app.core.exceptions import ApiError
from app.modules.audit_logs.repository import AuditRepository
from app.modules.audit_logs.schemas import AuditListResponse, AuditResponse


class AuditService(CatalogueService):
    repository = AuditRepository
    response_model = AuditResponse
    list_model = AuditListResponse
    permission = "audit.read"
    operation = "listAuditLogs"
    sorts = {
        "id": ("id",),
        "-id": ("id",),
        "createdAt": ("createdAt", "id"),
        "-createdAt": ("createdAt", "id"),
    }

    def list(self, *, createdFrom=None, createdTo=None, sort="-createdAt", actorId=None, **filters):
        if createdFrom is not None and createdTo is not None and createdFrom >= createdTo:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid created-time interval")
        return super().list(
            createdFrom=createdFrom,
            createdTo=createdTo,
            sort=sort,
            actorId=None if actorId is None else int(actorId),
            **filters,
        )
