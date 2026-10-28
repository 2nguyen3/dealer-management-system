from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Path, Query, Request, Response
from fastapi.responses import JSONResponse

from app.common.catalogue_http import MatchHeader, responses
from app.common.preconditions import read_preconditions
from app.common.schemas import BusinessDate, Cursor, Id, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.document_core.schemas import (
    DocumentKind,
    DocumentLine,
    DocumentList,
    DocumentStatus,
    Revision,
    RevisionState,
)
from app.modules.document_history.dependencies import get_history_service
from app.modules.document_history.printing import print_snapshot
from app.modules.document_history.schemas import GoodsLine, LineList, RevisionList
from app.modules.document_history.service import DocumentHistoryService

router = APIRouter(prefix="/documents", tags=["Document History"], route_class=BusinessRoute)
Service = Annotated[DocumentHistoryService, Depends(get_history_service)]
RevisionNo = Annotated[int, Path(ge=1)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]
READ = {"conditional": "Quyền đọc của kind chứng từ"}
WRITE = {"conditional": "Quyền prepare theo kind chứng từ"}


def line_responses(*statuses, **kwargs):
    result = responses(*statuses, **kwargs)
    if 204 in result:
        result[204]["headers"]["ETag"] = {"schema": {"type": "string", "pattern": '^"[^"]+"$'}}
    return result


@router.get(
    "",
    operation_id="searchDocuments",
    response_model=DocumentList,
    responses=responses(200, 400, 401, 403, 422, 429, 500),
    openapi_extra={
        "x-permissions": {"conditional": "Quyền đọc theo kind giống GET collection chuyên biệt"}
    },
)
def search_documents(
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    q: NonEmptyText | None = None,
    code: NonEmptyText | None = None,
    kind: DocumentKind | None = None,
    status: DocumentStatus | None = None,
    agencyId: Id | None = None,
    originDocumentId: Id | None = None,
    productId: Id | None = None,
    fromDate: BusinessDate | None = None,
    toDate: BusinessDate | None = None,
    sort: Literal[
        "id",
        "-id",
        "businessDate",
        "-businessDate",
        "totalAmount",
        "-totalAmount",
        "createdAt",
        "-createdAt",
    ] = "-businessDate",
):
    return service.search(
        limit=limit,
        cursor=cursor,
        q=q,
        code=code,
        kind=kind,
        status=status,
        agencyId=agencyId,
        originDocumentId=originDocumentId,
        productId=productId,
        fromDate=fromDate,
        toDate=toDate,
        sort=sort,
    )


@router.get(
    "/{documentId}/revisions",
    operation_id="listDocumentRevisions",
    response_model=RevisionList,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_revisions(
    documentId: Id,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    state: RevisionState | None = None,
    sort: Literal["revisionNo", "-revisionNo"] = "-revisionNo",
):
    return service.revisions(int(documentId), limit=limit, cursor=cursor, state=state, sort=sort)


@router.get(
    "/{documentId}/revisions/{revisionNo}",
    operation_id="getDocumentRevision",
    response_model=Revision,
    responses=responses(200, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def get_revision(documentId: Id, revisionNo: RevisionNo, service: Service):
    return service.revision(int(documentId), revisionNo)


@router.get(
    "/{documentId}/revisions/{revisionNo}/lines",
    operation_id="listDocumentLines",
    response_model=LineList,
    responses=responses(200, 400, 401, 403, 404, 422, 429, 500),
    openapi_extra={"x-permissions": READ},
)
def list_lines(
    documentId: Id,
    revisionNo: RevisionNo,
    service: Service,
    limit: Limit = 25,
    cursor: Cursor | None = None,
    productId: Id | None = None,
    sort: Literal["lineNo", "-lineNo"] = "lineNo",
):
    return service.lines(
        int(documentId), revisionNo, limit=limit, cursor=cursor, productId=productId, sort=sort
    )


@router.get(
    "/{documentId}/revisions/{revisionNo}/lines/{lineId}",
    operation_id="getDocumentLine",
    response_model=DocumentLine,
    responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
    openapi_extra={"x-permissions": READ},
)
def get_line(
    documentId: Id, revisionNo: RevisionNo, lineId: Id, service: Service, response: Response
):
    item = service.line(int(documentId), revisionNo, int(lineId))
    response.headers["ETag"] = service.core.etag(service.core.get(int(documentId)))
    return item


@router.post(
    "/{documentId}/revisions/{revisionNo}/lines",
    operation_id="createDocumentLine",
    response_model=DocumentLine,
    status_code=201,
    responses=responses(201, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={
        "x-permissions": {
            "conditional": "stock.receipt.prepare / stock.issue.prepare / "
            "stock.adjustment.prepare / returns.prepare theo kind"
        }
    },
)
def create_line(
    documentId: Id,
    revisionNo: RevisionNo,
    body: GoodsLine,
    service: Service,
    request: Request,
    match: MatchHeader,
    key: Key,
):
    result = service.create_line(
        int(documentId), revisionNo, body, read_preconditions(request), key
    )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.put(
    "/{documentId}/revisions/{revisionNo}/lines/{lineId}",
    operation_id="replaceDocumentLine",
    response_model=DocumentLine,
    responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
    openapi_extra={"x-permissions": WRITE},
)
def replace_line(
    documentId: Id,
    revisionNo: RevisionNo,
    lineId: Id,
    body: GoodsLine,
    service: Service,
    request: Request,
    match: MatchHeader,
):
    result = service.change_line(
        int(documentId), revisionNo, read_preconditions(request), body, int(lineId)
    )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.delete(
    "/{documentId}/revisions/{revisionNo}/lines/{lineId}",
    operation_id="deleteDocumentLine",
    status_code=204,
    responses=line_responses(204, 401, 403, 404, 409, 412, 422, 428, 429, 500),
    openapi_extra={"x-permissions": WRITE},
)
def delete_line(
    documentId: Id,
    revisionNo: RevisionNo,
    lineId: Id,
    service: Service,
    request: Request,
    match: MatchHeader,
):
    result = service.change_line(
        int(documentId), revisionNo, read_preconditions(request), line_id=int(lineId)
    )
    return Response(status_code=204, headers=result.headers)


PRINT_RESPONSES = responses(200, 401, 403, 404, 406, 422, 429, 500)
PRINT_RESPONSES[200]["content"] = {
    "text/html": {"schema": {"type": "string"}},
    "application/pdf": {"schema": {"type": "string", "format": "binary"}},
}


@router.get(
    "/{documentId}/print",
    operation_id="printDocument",
    responses=PRINT_RESPONSES,
    response_class=Response,
    openapi_extra={"x-permissions": READ},
)
def print_document(
    documentId: Id,
    service: Service,
    request: Request,
    revisionNo: Annotated[int | None, Query(ge=1)] = None,
):
    document = service.core.get(int(documentId)).model_dump(mode="json")
    revision = (
        document["currentRevision"]
        if revisionNo is None
        else service.revision(int(documentId), revisionNo).model_dump(mode="json")
    )
    service.session.rollback()  # Renderer consumes detached authorized snapshots only.
    content, media, headers = print_snapshot(document, revision, request.headers.get("accept"))
    return Response(content, media_type=media, headers=headers)
