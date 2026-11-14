"""Router factory shared by /stock-receipts, /stock-issues and /payment-receipts.

Each kind exposes the same eight operations (handoff 5.2/5.3): list, get, create
draft, replace draft (PUT), delete draft, post, cancel with reason and correct with
reason. Drafts and posted documents use strong ETags with If-Match.
"""

from functools import partial
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response

from app.common.catalogue_http import (
    AuthDependency,
    MatchHeader,
    PrincipalDependency,
    SessionDependency,
    make_service,
    responses,
)
from app.common.preconditions import read_preconditions
from app.common.schemas import BusinessDate, Cursor, Id, Limit, NonEmptyText
from app.common.transport import BusinessRoute
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.service import Principal
from app.modules.document_core.schemas import (
    CORRECTIONS,
    INPUTS,
    Document,
    DocumentList,
    DocumentStatus,
    Reason,
    ReceiptType,
)
from app.modules.document_core.service import PERMISSIONS, DocumentService

Sort = Literal[
    "id",
    "-id",
    "businessDate",
    "-businessDate",
    "totalAmount",
    "-totalAmount",
    "createdAt",
    "-createdAt",
    "postedAt",
    "-postedAt",
]
CORRECT_EXTRA = ("documents.correct", "documents.cancel")


def document_router(
    kind: str, prefix: str, tag: str, names: dict[str, str], read_any: tuple[str, ...]
) -> APIRouter:
    """names maps operation verbs to operationId stems, e.g. {"one": "StockReceipt"}."""
    prepare, post = PERMISSIONS[kind]
    read_any = (*read_any, prepare, post, *CORRECT_EXTRA)
    router = APIRouter(prefix=prefix, tags=[tag], route_class=BusinessRoute)
    body_model = INPUTS[kind]
    correction_model = CORRECTIONS[kind]
    one, many = names["one"], names["many"]

    def get_service(
        request: Request,
        session: SessionDependency,
        principal: PrincipalDependency,
        auth: AuthDependency,
    ) -> DocumentService:
        return make_service(partial(DocumentService, kind=kind), request, session, principal, auth)

    Service = Annotated[DocumentService, Depends(get_service)]
    Reader = Annotated[
        Principal, Depends(require_permissions(any_of=tuple(dict.fromkeys(read_any))))
    ]
    Preparer = Annotated[Principal, Depends(require_permissions(all_of=(prepare,)))]
    Poster = Annotated[Principal, Depends(require_permissions(all_of=(post,)))]
    Canceller = Annotated[Principal, Depends(require_permissions(all_of=("documents.cancel",)))]
    Corrector = Annotated[
        Principal, Depends(require_permissions(all_of=("documents.correct", post)))
    ]

    def reply(response: Response, service: DocumentService, item: Document) -> Document:
        response.headers["ETag"] = service.etag(item)
        return item

    @router.get(
        "",
        operation_id=f"list{many}",
        response_model=DocumentList,
        responses=responses(200, 400, 401, 403, 422, 429, 500),
        openapi_extra={"x-permissions": {"anyOf": list(dict.fromkeys(read_any))}},
    )
    def list_documents(
        principal: Reader,
        service: Service,
        limit: Limit = 25,
        cursor: Cursor | None = None,
        q: NonEmptyText | None = None,
        code: NonEmptyText | None = None,
        status: DocumentStatus | None = None,
        agencyId: Id | None = None,
        productId: Id | None = None,
        receiptType: ReceiptType | None = None,
        fromDate: BusinessDate | None = None,
        toDate: BusinessDate | None = None,
        sort: Sort = "-businessDate",
    ):
        return service.list(
            limit=limit,
            cursor=cursor,
            q=q,
            code=code,
            status=status,
            agencyId=agencyId,
            productId=productId,
            receiptType=receiptType,
            fromDate=fromDate,
            toDate=toDate,
            sort=sort,
        )

    @router.get(
        "/{documentId}",
        operation_id=f"get{one}",
        response_model=Document,
        responses=responses(200, 401, 403, 404, 422, 429, 500, etag=True),
        openapi_extra={"x-permissions": {"anyOf": list(dict.fromkeys(read_any))}},
    )
    def get_document(documentId: Id, principal: Reader, service: Service, response: Response):
        return reply(response, service, service.get(int(documentId)))

    @router.post(
        "",
        operation_id=f"create{one}",
        response_model=Document,
        status_code=201,
        responses=responses(201, 400, 401, 403, 404, 409, 415, 422, 429, 500, etag=True),
        openapi_extra={"x-permissions": {"allOf": [prepare]}},
    )
    def create_document(
        body: body_model, principal: Preparer, service: Service, response: Response
    ):
        item = service.create(body)
        response.headers["Location"] = f"/api/v1{prefix}/{item.id}"
        return reply(response, service, item)

    @router.put(
        "/{documentId}",
        operation_id=f"replace{one}Draft",
        response_model=Document,
        responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
        openapi_extra={"x-permissions": {"allOf": [prepare]}},
    )
    def replace_document(
        documentId: Id,
        body: body_model,
        principal: Preparer,
        service: Service,
        request: Request,
        response: Response,
        match: MatchHeader,
    ):
        item = service.replace(int(documentId), body, read_preconditions(request))
        return reply(response, service, item)

    @router.delete(
        "/{documentId}",
        operation_id=f"delete{one}Draft",
        status_code=204,
        responses=responses(204, 401, 403, 404, 409, 412, 422, 428, 429, 500),
        openapi_extra={"x-permissions": {"allOf": [prepare]}},
    )
    def delete_document(
        documentId: Id, principal: Preparer, service: Service, request: Request, match: MatchHeader
    ):
        service.delete(int(documentId), read_preconditions(request))
        return Response(status_code=204)

    @router.post(
        "/{documentId}/post",
        operation_id=f"post{one}",
        response_model=Document,
        responses=responses(200, 401, 403, 404, 409, 412, 422, 428, 429, 500, etag=True),
        openapi_extra={"x-permissions": {"allOf": [post]}},
    )
    def post_document(
        documentId: Id,
        principal: Poster,
        service: Service,
        request: Request,
        response: Response,
        match: MatchHeader,
    ):
        item = service.post(int(documentId), read_preconditions(request))
        return reply(response, service, item)

    @router.post(
        "/{documentId}/cancel",
        operation_id=f"cancel{one}",
        response_model=Document,
        responses=responses(200, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
        openapi_extra={"x-permissions": {"allOf": ["documents.cancel"]}},
    )
    def cancel_document(
        documentId: Id,
        body: Reason,
        principal: Canceller,
        service: Service,
        request: Request,
        response: Response,
        match: MatchHeader,
    ):
        item = service.cancel(int(documentId), body.reason, read_preconditions(request))
        return reply(response, service, item)

    @router.post(
        "/{documentId}/corrections",
        operation_id=f"correct{one}",
        response_model=Document,
        status_code=201,
        responses=responses(201, 400, 401, 403, 404, 409, 412, 415, 422, 428, 429, 500, etag=True),
        openapi_extra={"x-permissions": {"allOf": ["documents.correct", post]}},
    )
    def correct_document(
        documentId: Id,
        body: correction_model,
        principal: Corrector,
        service: Service,
        request: Request,
        response: Response,
        match: MatchHeader,
    ):
        item = service.correct(int(documentId), body, read_preconditions(request))
        response.headers["Location"] = f"/api/v1{prefix}/{item.id}"
        return reply(response, service, item)

    return router
