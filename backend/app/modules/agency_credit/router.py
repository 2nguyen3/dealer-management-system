from typing import Annotated, Literal

from fastapi import APIRouter, Depends

from app.common.catalogue_http import responses
from app.common.schemas import BusinessDate, Cursor, Id, Limit
from app.common.transport import BusinessRoute
from app.modules.agency_credit.dependencies import get_agency_credit_service
from app.modules.agency_credit.schemas import CreditLot, CreditLotList, CreditStatement
from app.modules.agency_credit.service import AgencyCreditService
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal

router = APIRouter(tags=["Agency Credit"], route_class=BusinessRoute)
READ = {"anyOf": ["debt.read", "credit.apply", "cash.refund.post"]}
DEBT = {"allOf": ["debt.read"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
DebtReader = Annotated[Principal, Depends(require_permissions(all_of=("debt.read",)))]
Service = Annotated[AgencyCreditService, Depends(get_agency_credit_service)]


@router.get(
    "/agencies/{agencyId}/credit-lots",
    operation_id="listAgencyCreditLots",
    response_model=CreditLotList,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_agency_credit_lots(
    agencyId: Id,
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    originReceiptId: Id | None = None,
    availableOnly: bool = False,
    sort: Literal["id", "-id", "createdAt", "-createdAt"] = "-createdAt",
):
    return service.lots(
        int(agencyId),
        limit=limit,
        cursor=cursor,
        originReceiptId=originReceiptId,
        availableOnly=availableOnly,
        sort=sort,
    )


@router.get(
    "/credit-lots/{lotId}",
    operation_id="getCreditLot",
    response_model=CreditLot,
    responses=responses(200, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def get_credit_lot(lotId: Id, principal: Reader, service: Service):
    return service.lot(int(lotId))


@router.get(
    "/agencies/{agencyId}/credit-entries",
    operation_id="listAgencyCreditEntries",
    response_model=CreditStatement,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": DEBT},
)
def list_agency_credit_entries(
    agencyId: Id,
    principal: DebtReader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    fromDate: BusinessDate | None = None,
    toDate: BusinessDate | None = None,
    lotId: Id | None = None,
    kind: Literal["CREATED", "REFUND", "OFFSET"] | None = None,
    sourceDocumentId: Id | None = None,
    effectiveOnly: bool = True,
    sort: Literal["businessDate", "-businessDate"] = "businessDate",
):
    return service.statement(
        int(agencyId),
        limit=limit,
        cursor=cursor,
        fromDate=fromDate,
        toDate=toDate,
        lotId=lotId,
        kind=kind,
        sourceDocumentId=sourceDocumentId,
        effectiveOnly=effectiveOnly,
        sort=sort,
    )
