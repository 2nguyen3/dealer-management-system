from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response

from app.common.catalogue_http import responses
from app.common.schemas import Cursor, Id, Instant, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.audit_logs.dependencies import get_audit_service
from app.modules.audit_logs.schemas import AuditListResponse, AuditResponse, exact_json
from app.modules.audit_logs.service import AuditService
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"], route_class=BusinessRoute)
POLICY = {"allOf": ["audit.read"]}
Reader = Annotated[Principal, Depends(require_permissions(all_of=("audit.read",)))]
Service = Annotated[AuditService, Depends(get_audit_service)]


@router.get(
    "",
    operation_id="listAuditLogs",
    response_model=AuditListResponse,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": POLICY},
)
def list_audit_logs(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    actorId: Id | None = None,
    actorType: Literal["USER", "SYSTEM"] | None = None,
    functionCode: NonEmptyText | None = None,
    action: Literal["INSERT", "UPDATE", "DELETE"] | None = None,
    entityName: NonEmptyText | None = None,
    entityKey: NonEmptyText | None = None,
    requestId: NonEmptyText | None = None,
    createdFrom: Instant | None = None,
    createdTo: Instant | None = None,
    sort: Literal["id", "-id", "createdAt", "-createdAt"] = "-createdAt",
):
    item = service.list(
        limit=limit,
        cursor=cursor,
        actorId=actorId,
        actorType=actorType,
        functionCode=functionCode,
        action=action,
        entityName=entityName,
        entityKey=entityKey,
        requestId=requestId,
        createdFrom=createdFrom,
        createdTo=createdTo,
        sort=sort,
    )
    return Response(exact_json(item.model_dump()), media_type="application/json")


@router.get(
    "/{auditId}",
    operation_id="getAuditLog",
    response_model=AuditResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": POLICY},
)
def get_audit_log(auditId: Id, principal: Reader, service: Service):
    return Response(
        exact_json(service.get(int(auditId)).model_dump()), media_type="application/json"
    )
