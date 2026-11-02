from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.common.catalogue_http import responses
from app.common.schemas import BusinessDate, CatalogParameter, Id
from app.core.exceptions import ApiError
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.reports.dependencies import get_report_service
from app.modules.reports.exporting import negotiate_report_media, render_report
from app.modules.reports.schemas import (
    CashCreditReportResponse,
    DebtReportResponse,
    InventoryReportResponse,
    ProductSalesReportResponse,
    SalesReportResponse,
)
from app.modules.reports.service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])
Service = Annotated[ReportService, Depends(get_report_service)]
SalesReader = Annotated[
    Principal, Depends(require_permissions(all_of=("reports.read", "sales.read")))
]
DebtReader = Annotated[
    Principal, Depends(require_permissions(all_of=("reports.read", "debt.read")))
]
InventoryReader = Annotated[
    Principal, Depends(require_permissions(all_of=("reports.read", "inventory.read")))
]


def report_contract(permission, sorts, default):
    return {
        "x-permissions": {"allOf": ["reports.read", permission]},
        "parameters": [
            {"name": "cursor", "in": "query", "schema": {"type": "string", "minLength": 1}},
            {
                "name": "limit",
                "in": "query",
                "schema": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 25,
                },
            },
            {
                "name": "sort",
                "in": "query",
                "schema": {
                    "type": "string",
                    "enum": sorts,
                    "default": default,
                },
            },
        ],
    }


def report_responses():
    result = responses(200, 400, 401, 403, 406, 422, 429, 500)
    result[200]["headers"]["Content-Disposition"] = {
        "description": "Attachment filename for XLSX and PDF responses.",
        "schema": {"type": "string"},
    }
    result[200]["content"] = {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
            "schema": {"type": "string", "format": "binary"}
        },
        "application/pdf": {"schema": {"type": "string", "format": "binary"}},
    }
    return result


def read_report(kind, request, response, service, start, end, filters):
    media = negotiate_report_media(request.headers.get("accept"))
    exporting = media != "application/json"
    controls = {}
    if not exporting:
        raw = request.query_params.get("limit", "25")
        try:
            limit = int(raw)
        except ValueError:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid report page size") from None
        if not 1 <= limit <= 100:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid report page size")
        controls = {
            "cursor": request.query_params.get("cursor"),
            "limit": limit,
            "sort": request.query_params.get("sort"),
        }
    result = service.read(kind, start, end, filters=filters, export=exporting, **controls)
    if exporting:
        # A complete detached snapshot is rendered only after releasing the DB read.
        service.session.rollback()
        content, media, headers = render_report(result, media)
        return Response(content, media_type=media, headers=headers)
    response.headers["Vary"] = "Accept"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return result


@router.get(
    "/sales",
    operation_id="getSalesReport",
    response_model=SalesReportResponse,
    responses=report_responses(),
    openapi_extra=report_contract(
        "sales.read",
        [
            "agencyId",
            "-agencyId",
            "salesAmount",
            "-salesAmount",
            "netSalesAmount",
            "-netSalesAmount",
        ],
        "agencyId",
    ),
)
def get_sales_report(
    request: Request,
    response: Response,
    principal: SalesReader,
    service: Service,
    fromDate: BusinessDate,
    toDate: BusinessDate,
    agencyId: Id | None = None,
    typeId: CatalogParameter | None = None,
):
    return read_report(
        "sales",
        request,
        response,
        service,
        fromDate,
        toDate,
        {"agencyId": agencyId, "typeId": typeId},
    )


@router.get(
    "/debt",
    operation_id="getDebtReport",
    response_model=DebtReportResponse,
    responses=report_responses(),
    openapi_extra=report_contract(
        "debt.read", ["agencyId", "-agencyId", "closingDebt", "-closingDebt"], "agencyId"
    ),
)
def get_debt_report(
    request: Request,
    response: Response,
    principal: DebtReader,
    service: Service,
    fromDate: BusinessDate,
    toDate: BusinessDate,
    agencyId: Id | None = None,
    typeId: CatalogParameter | None = None,
    districtId: CatalogParameter | None = None,
):
    return read_report(
        "debt",
        request,
        response,
        service,
        fromDate,
        toDate,
        {"agencyId": agencyId, "typeId": typeId, "districtId": districtId},
    )


@router.get(
    "/inventory",
    operation_id="getInventoryReport",
    response_model=InventoryReportResponse,
    responses=report_responses(),
    openapi_extra=report_contract(
        "inventory.read", ["productId", "-productId", "closingStock", "-closingStock"], "productId"
    ),
)
def get_inventory_report(
    request: Request,
    response: Response,
    principal: InventoryReader,
    service: Service,
    fromDate: BusinessDate,
    toDate: BusinessDate,
    productId: Id | None = None,
):
    return read_report(
        "inventory", request, response, service, fromDate, toDate, {"productId": productId}
    )


@router.get(
    "/product-sales",
    operation_id="getProductSalesReport",
    response_model=ProductSalesReportResponse,
    responses=report_responses(),
    openapi_extra=report_contract(
        "sales.read",
        ["productId", "-productId", "salesAmount", "-salesAmount", "soldQuantity", "-soldQuantity"],
        "-salesAmount",
    ),
)
def get_product_sales_report(
    request: Request,
    response: Response,
    principal: SalesReader,
    service: Service,
    fromDate: BusinessDate,
    toDate: BusinessDate,
    productId: Id | None = None,
    agencyId: Id | None = None,
):
    return read_report(
        "product-sales",
        request,
        response,
        service,
        fromDate,
        toDate,
        {"productId": productId, "agencyId": agencyId},
    )


@router.get(
    "/cash-and-credit",
    operation_id="getCashAndCreditReport",
    response_model=CashCreditReportResponse,
    responses=report_responses(),
    openapi_extra=report_contract(
        "debt.read",
        [
            "agencyId",
            "-agencyId",
            "cashReceived",
            "-cashReceived",
            "closingCredit",
            "-closingCredit",
        ],
        "agencyId",
    ),
)
def get_cash_and_credit_report(
    request: Request,
    response: Response,
    principal: DebtReader,
    service: Service,
    fromDate: BusinessDate,
    toDate: BusinessDate,
    agencyId: Id | None = None,
):
    return read_report(
        "cash-and-credit", request, response, service, fromDate, toDate, {"agencyId": agencyId}
    )
