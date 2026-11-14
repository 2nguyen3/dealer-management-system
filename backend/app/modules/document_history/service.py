"""Read-only history over all three document kinds (handoff 5.2 ``document_history``).

A user sees a document only when they could read its kind through the kind's own
routes; the per-kind read policies below mirror those routers (an offline test keeps
them in sync). Lines of drafts change only through each kind's ``PUT /{documentId}``.
"""

from collections.abc import Callable, Iterable
from functools import cached_property

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.common.catalogue import CatalogueService
from app.common.pagination import CursorCodec
from app.core.exceptions import ApiError, AuthError
from app.modules.document_core.schemas import Document, DocumentList, DocumentSummary
from app.modules.document_core.service import DocumentService
from app.modules.document_history.repository import HistoryRepository
from app.modules.document_history.schemas import ChainItem, DocumentChain

KINDS = ("STOCK_RECEIPT", "STOCK_ISSUE", "PAYMENT_RECEIPT")
EDITORS = ("documents.correct", "documents.cancel")
READ_PERMISSIONS = {
    "STOCK_RECEIPT": (
        "product.manage",
        "reports.read",
        "stock.receipt.prepare",
        "stock.receipt.post",
        *EDITORS,
    ),
    "STOCK_ISSUE": (
        "sales.read",
        "debt.read",
        "reports.read",
        "stock.issue.prepare",
        "stock.issue.post",
        *EDITORS,
    ),
    "PAYMENT_RECEIPT": (
        "debt.read",
        "payments.online",
        "reports.read",
        "cash.receipt.prepare",
        "cash.receipt.post",
        *EDITORS,
    ),
}
ANY_READ = tuple(dict.fromkeys(code for kind in KINDS for code in READ_PERMISSIONS[kind]))


def forbidden() -> AuthError:
    return AuthError(403, "FORBIDDEN", "Permission denied")


def not_found() -> ApiError:
    return ApiError(404, "NOT_FOUND", "Document not found")


class DocumentHistoryService(CatalogueService):
    repository = HistoryRepository
    response_model = DocumentSummary
    list_model = DocumentList
    operation = "searchDocuments"
    search_fields = DocumentService.search_fields
    sorts = DocumentService.sorts

    def __init__(
        self,
        session: Session,
        codec: CursorCodec,
        actor_id: int | None,
        request_id: str,
        authorize: Callable[[tuple[str, ...]], None],
        *,
        allowed_functions: Callable[[], Iterable[str]],
    ) -> None:
        super().__init__(session, codec, actor_id, request_id, authorize)
        self.allowed_functions = allowed_functions

    # ------------------------------------------------------- authorization ----

    @cached_property
    def readable_kinds(self) -> tuple[str, ...]:
        allowed = set(self.allowed_functions())
        return tuple(kind for kind in KINDS if allowed & set(READ_PERMISSIONS[kind]))

    def require_kind(self, kind: str) -> None:
        if kind not in self.readable_kinds:
            raise forbidden()

    def core(self, kind: str) -> DocumentService:
        return DocumentService(
            self.session, self.codec, self.actor_id, self.request_id, self.authorize, kind=kind
        )

    # --------------------------------------------------------------- reads ----

    def search(self, *, kind=None, fromDate=None, toDate=None, sort="-businessDate", **filters):
        if kind is not None:
            self.require_kind(kind)
        elif not self.readable_kinds:
            raise forbidden()
        if fromDate is not None and toDate is not None and fromDate >= toDate:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid business-date interval")
        return self.list(
            kind=kind,
            kinds=list(self.readable_kinds),
            fromDate=fromDate,
            toDate=toDate,
            sort=sort,
            **filters,
        )

    def get(self, identifier: int) -> Document:
        row = self.repo.document(identifier)
        if row is None:
            raise not_found()
        self.require_kind(row["kind"])
        return self.core(row["kind"]).project(row)

    def etag(self, item: BaseModel) -> str:
        return self.core(item.kind).etag(item)

    def chain(self, identifier: int) -> DocumentChain:
        self.get(identifier)
        identifiers = self.repo.chain_ids(identifier)
        rows = self.repo.summaries(identifiers)
        items = [ChainItem.model_validate(rows[value]) for value in identifiers]
        # Corrections keep the kind, so this only rejects hand-edited mixed chains.
        for item in items:
            self.require_kind(item.kind)
        return DocumentChain(items=items)
