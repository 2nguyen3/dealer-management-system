from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response

from app.common.catalogue_http import MasterStatus, MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import CatalogParameter, Cursor, Id, Limit, NonEmptyText, Quantity
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.products.dependencies import get_product_service
from app.modules.products.schemas import (
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
)
from app.modules.products.service import ProductService

router = APIRouter(prefix="/products", tags=["Products"], route_class=BusinessRoute)
READ = {"anyOf": ["product.manage", "inventory.read"]}
WRITE = {"allOf": ["product.manage"]}
Reader = Annotated[Principal, Depends(require_permissions(any_of=tuple(READ["anyOf"])))]
Writer = Annotated[Principal, Depends(require_permissions(all_of=("product.manage",)))]
Service = Annotated[ProductService, Depends(get_product_service)]


@router.get(
    "",
    operation_id="listProducts",
    response_model=ProductListResponse,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_products(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    status: MasterStatus | None = None,
    unitId: CatalogParameter | None = None,
    isLowStock: bool | None = None,
    stockFrom: Quantity | None = None,
    stockTo: Quantity | None = None,
    sort: Literal[
        "id",
        "-id",
        "name",
        "-name",
        "currentStock",
        "-currentStock",
        "currentSellingPrice",
        "-currentSellingPrice",
    ] = "id",
):
    return service.list(
        limit=limit,
        cursor=cursor,
        q=q,
        code=code,
        status=status,
        unitId=unitId,
        isLowStock=isLowStock,
        stockFrom=stockFrom,
        stockTo=stockTo,
        sort=sort,
    )


@router.get(
    "/{productId}",
    operation_id="getProduct",
    response_model=ProductResponse,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_product(productId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(productId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.post(
    "",
    operation_id="createProduct",
    response_model=ProductResponse,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def create_product(body: ProductCreate, principal: Writer, service: Service, response: Response):
    item = service.create(body)
    response.headers["ETag"] = service.etag(item)
    response.headers["Location"] = "/api/v1/products/" + item.id
    return item


@router.patch(
    "/{productId}",
    operation_id="updateProduct",
    response_model=ProductResponse,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def update_product(
    productId: Id,
    body: ProductUpdate,
    principal: Writer,
    service: Service,
    request: Request,
    response: Response,
    match: MatchHeader,
):
    item = service.update(int(productId), body, read_preconditions(request))
    response.headers["ETag"] = service.etag(item)
    return item


@router.delete(
    "/{productId}",
    operation_id="deleteProduct",
    status_code=204,
    responses=responses(204, 401, 403, 404, 409, 412, 422, 428, 429, 500),
    openapi_extra={"x-permissions": WRITE},
)
def delete_product(
    productId: Id, principal: Writer, service: Service, request: Request, match: MatchHeader
):
    service.delete(int(productId), read_preconditions(request))
    return Response(status_code=204)
