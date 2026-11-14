"""/documents: search, detail, replacement chain and printing across the three kinds."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.common.catalogue_http import responses
from app.common.schemas import BusinessDate, Cursor, Id, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.document_core.schemas import (
    Document,
    DocumentKind,
    DocumentList,
    DocumentStatus,
    ReceiptType,
)
from app.modules.document_history.dependencies import get_history_service
from app.modules.document_history.printing import print_document
from app.modules.document_history.schemas import DocumentChain, HistorySort
from app.modules.document_history.service import ANY_READ, DocumentHistoryService

router = APIRouter(prefix="/documents", tags=["Document History"], route_class=BusinessRoute)
Service = Annotated[DocumentHistoryService, Depends(get_history_service)]
Reader = Annotated[Principal, Depends(require_permissions(any_of=ANY_READ))]
READ = {
    "x-permissions": {
        "anyOf": list(ANY_READ),
        "conditional": "Only kinds readable through their own routes are returned",
    }
}
PRINT_RESPONSES = responses(200, 401, 403, 404, 406, 422, 429, 500)
PRINT_RESPONSES[200]["content"] = {
    "text/html": {"schema": {"type": "string"}},
    "application/pdf": {"schema": {"type": "string", "format": "binary"}},
}


@router.get(
    "",
    operation_id="searchDocuments",
    response_model=DocumentList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra=READ,
)
def search_documents(
    principal: Reader,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    kind: DocumentKind | None = None,
    status: DocumentStatus | None = None,
    agencyId: Id | None = None,
    productId: Id | None = None,
    receiptType: ReceiptType | None = None,
    createdBy: Id | None = None,
    postedBy: Id | None = None,
    fromDate: BusinessDate | None = None,
    toDate: BusinessDate | None = None,
    sort: HistorySort = "-businessDate",
):
    return service.search(
        limit=limit,
        cursor=cursor,
        q=q,
        code=code,
        kind=kind,
        status=status,
        agencyId=agencyId,
        productId=productId,
        receiptType=receiptType,
        createdBy=createdBy,
        postedBy=postedBy,
        fromDate=fromDate,
        toDate=toDate,
        sort=sort,
    )


@router.get(
    "/{documentId}",
    operation_id="getDocument",
    response_model=Document,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra=READ,
)
def get_document(documentId: Id, principal: Reader, service: Service, response: Response):
    item = service.get(int(documentId))
    response.headers["ETag"] = service.etag(item)
    return item


@router.get(
    "/{documentId}/chain",
    operation_id="getDocumentChain",
    response_model=DocumentChain,
    responses=responses(200, 401, 403, 404, 422, 429, 500),
    openapi_extra=READ,
)
def get_document_chain(documentId: Id, principal: Reader, service: Service):
    return service.chain(int(documentId))


@router.get(
    "/{documentId}/print",
    operation_id="printDocument",
    responses=PRINT_RESPONSES,
    response_class=Response,
    openapi_extra=READ,
)
def print_document_route(documentId: Id, principal: Reader, service: Service, request: Request):
    document = service.get(int(documentId)).model_dump(mode="json")
    service.session.rollback()  # The renderer only consumes the detached projection.
    content, media, headers = print_document(document, request.headers.get("accept"))
    return Response(content, media_type=media, headers=headers)
