from typing import Annotated, Literal

from fastapi import APIRouter, Depends

from app.common.catalogue_http import responses
from app.common.schemas import (
    BusinessDate,
    CatalogParameter,
    Cursor,
    Id,
    Limit,
    Money,
    NonEmptyText,
)
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.document_core.schemas import AgencyBalance, InvoiceBalance
from app.modules.receivables.dependencies import get_receivable_service
from app.modules.receivables.schemas import (
    AllocationList,
    InvoiceBalanceList,
    ReceivableKind,
    ReceivableOverviewList,
    ReceivableStatement,
    SettlementStatus,
)
from app.modules.receivables.service import ReceivableService

router = APIRouter(tags=["Receivables"], route_class=BusinessRoute)
READ = {"allOf": ["debt.read"]}
BALANCE = {"anyOf": ["debt.read", "credit.apply", "cash.refund.post"]}
Reader = Annotated[Principal, Depends(require_permissions(all_of=("debt.read",)))]
BalanceReader = Annotated[Principal, Depends(require_permissions(any_of=tuple(BALANCE["anyOf"])))]
Service = Annotated[ReceivableService, Depends(get_receivable_service)]


@router.get(
    "/receivables",
    operation_id="listReceivables",
    response_model=ReceivableOverviewList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_receivables(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    agencyId: Id | None = None,
    typeId: CatalogParameter | None = None,
    districtId: CatalogParameter | None = None,
    debtFrom: Money | None = None,
    debtTo: Money | None = None,
    status: Literal["ACTIVE", "TERMINATED"] | None = None,
    sort: Literal[
        "agencyId",
        "-agencyId",
        "currentDebt",
        "-currentDebt",
        "remainingCreditLimit",
        "-remainingCreditLimit",
    ] = "-currentDebt",
):
    return service.overview(
        limit=limit,
        cursor=cursor,
        q=q,
        agencyId=agencyId,
        typeId=typeId,
        districtId=districtId,
        debtFrom=debtFrom,
        debtTo=debtTo,
        status=status,
        sort=sort,
    )


@router.get(
    "/agencies/{agencyId}/balance",
    operation_id="getAgencyBalance",
    response_model=AgencyBalance,
    tags=["Agency Credit"],
    responses=responses(200, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": BALANCE},
)
def get_agency_balance(agencyId: Id, principal: BalanceReader, service: Service):
    return service.balance(int(agencyId))


@router.get(
    "/agencies/{agencyId}/invoice-balances",
    operation_id="listAgencyInvoiceBalances",
    response_model=InvoiceBalanceList,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_agency_invoice_balances(
    agencyId: Id,
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    code: NonEmptyText | None = None,
    settlementStatus: SettlementStatus | None = None,
    fromDate: BusinessDate | None = None,
    toDate: BusinessDate | None = None,
    sort: Literal[
        "id", "-id", "businessDate", "-businessDate", "outstandingAmount", "-outstandingAmount"
    ] = "businessDate",
):
    return service.invoices(
        int(agencyId),
        limit=limit,
        cursor=cursor,
        code=code,
        settlementStatus=settlementStatus,
        fromDate=fromDate,
        toDate=toDate,
        sort=sort,
    )


@router.get(
    "/stock-issues/{documentId}/balance",
    operation_id="getInvoiceBalance",
    response_model=InvoiceBalance,
    responses=responses(200, 401, 403, 404, 409, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def get_invoice_balance(documentId: Id, principal: Reader, service: Service):
    return service.invoice(int(documentId))


@router.get(
    "/agencies/{agencyId}/receivable-entries",
    operation_id="listAgencyReceivableEntries",
    response_model=ReceivableStatement,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_agency_receivable_entries(
    agencyId: Id,
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    fromDate: BusinessDate | None = None,
    toDate: BusinessDate | None = None,
    sourceDocumentId: Id | None = None,
    issueDocumentId: Id | None = None,
    kind: ReceivableKind | None = None,
    effectiveOnly: bool = True,
    sort: Literal["businessDate", "-businessDate"] = "businessDate",
):
    return service.statement(
        int(agencyId),
        limit=limit,
        cursor=cursor,
        fromDate=fromDate,
        toDate=toDate,
        sourceDocumentId=sourceDocumentId,
        issueDocumentId=issueDocumentId,
        kind=kind,
        effectiveOnly=effectiveOnly,
        sort=sort,
    )


@router.get(
    "/documents/{documentId}/allocations",
    operation_id="listDocumentAllocations",
    response_model=AllocationList,
    responses=responses(200, 400, 401, 403, 404, 409, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_document_allocations(
    documentId: Id,
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    effectiveOnly: bool = True,
    sort: Literal["businessDate", "-businessDate"] = "businessDate",
):
    return service.allocations(
        int(documentId), limit=limit, cursor=cursor, effectiveOnly=effectiveOnly, sort=sort
    )
