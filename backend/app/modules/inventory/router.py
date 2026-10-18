from typing import Annotated, Literal

from fastapi import APIRouter, Depends

from app.common.catalogue_http import responses
from app.common.schemas import BusinessDate, Cursor, Id, Limit
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.inventory.dependencies import get_inventory_service
from app.modules.inventory.schemas import InventoryStatement
from app.modules.inventory.service import InventoryService

router = APIRouter(prefix="/products", tags=["Inventory"], route_class=BusinessRoute)
Reader = Annotated[Principal, Depends(require_permissions(all_of=("inventory.read",)))]
Service = Annotated[InventoryService, Depends(get_inventory_service)]


@router.get(
    "/{productId}/inventory-entries",
    operation_id="listProductInventoryEntries",
    response_model=InventoryStatement,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": {"allOf": ["inventory.read"]}},
)
def list_product_inventory_entries(
    productId: Id,
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    fromDate: BusinessDate | None = None,
    toDate: BusinessDate | None = None,
    sourceDocumentId: Id | None = None,
    effectiveOnly: bool = True,
    sort: Literal["businessDate", "-businessDate"] = "businessDate",
):
    return service.statement(
        int(productId),
        limit=limit,
        cursor=cursor,
        fromDate=fromDate,
        toDate=toDate,
        sourceDocumentId=sourceDocumentId,
        effectiveOnly=effectiveOnly,
        sort=sort,
    )
