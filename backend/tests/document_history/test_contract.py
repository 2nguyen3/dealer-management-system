from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from pydantic import ValidationError

from app.common.pagination import CursorCodec
from app.core.exceptions import ApiError, AuthError
from app.modules.auth.permissions import FUNCTION_CODES
from app.modules.document_history.router import router
from app.modules.document_history.schemas import ChainItem, DocumentChain
from app.modules.document_history.service import (
    ANY_READ,
    KINDS,
    READ_PERMISSIONS,
    DocumentHistoryService,
)
from app.modules.payment_receipts.router import router as payment_receipts
from app.modules.stock_issues.router import router as stock_issues
from app.modules.stock_receipts.router import router as stock_receipts

KIND_ROUTERS = {
    "STOCK_RECEIPT": stock_receipts,
    "STOCK_ISSUE": stock_issues,
    "PAYMENT_RECEIPT": payment_receipts,
}


def openapi():
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    return app.openapi()


def service(allowed=ANY_READ, session=None):
    return DocumentHistoryService(
        session or MagicMock(),
        CursorCodec(b"h" * 32),
        1,
        "request",
        lambda _: None,
        allowed_functions=lambda: allowed,
    )


@pytest.mark.parametrize("kind", KINDS)
def test_read_policy_mirrors_each_kind_router(kind):
    readers = {
        route.operation_id: set(route.openapi_extra["x-permissions"]["anyOf"])
        for route in KIND_ROUTERS[kind].routes
        if "GET" in route.methods
    }
    assert len(readers) == 2
    assert all(codes == set(READ_PERMISSIONS[kind]) for codes in readers.values())


def test_any_read_is_the_union_of_known_codes():
    assert set(ANY_READ) == set().union(*map(set, READ_PERMISSIONS.values()))
    assert len(ANY_READ) == len(set(ANY_READ)) and set(ANY_READ) <= FUNCTION_CODES


def test_routes_and_parameters():
    paths = openapi()["paths"]
    assert {path: sorted(item) for path, item in paths.items()} == {
        "/api/v1/documents": ["get"],
        "/api/v1/documents/{documentId}": ["get"],
        "/api/v1/documents/{documentId}/chain": ["get"],
        "/api/v1/documents/{documentId}/print": ["get"],
    }
    operations = {path: item["get"] for path, item in paths.items()}
    assert [operation["operationId"] for operation in operations.values()] == [
        "searchDocuments",
        "getDocument",
        "getDocumentChain",
        "printDocument",
    ]
    search = {parameter["name"] for parameter in operations["/api/v1/documents"]["parameters"]}
    assert search == {
        "limit",
        "cursor",
        "q",
        "code",
        "kind",
        "status",
        "agencyId",
        "productId",
        "receiptType",
        "createdBy",
        "postedBy",
        "fromDate",
        "toDate",
        "sort",
    }
    printing = operations["/api/v1/documents/{documentId}/print"]
    assert [parameter["name"] for parameter in printing["parameters"]] == ["documentId"]
    assert set(printing["responses"]["200"]["content"]) == {"text/html", "application/pdf"}
    detail = operations["/api/v1/documents/{documentId}"]
    assert "ETag" in detail["responses"]["200"]["headers"]
    for operation in operations.values():
        assert operation["x-permissions"]["anyOf"] == list(ANY_READ)


def test_chain_schema():
    base = {
        "id": "1",
        "code": "PX-1",
        "kind": "STOCK_ISSUE",
        "status": "CANCELLED",
        "businessDate": "2026-11-01",
        "agencyId": "2",
        "agencyCode": None,
        "agencyName": "Đại lý Thành Đạt",
        "receiptType": None,
        "totalAmount": "102000",
        "lineCount": 1,
        "note": None,
        "replacesDocumentId": None,
        "replacedByDocumentId": "3",
        "createdBy": None,
        "createdByName": None,
        "postedBy": None,
        "postedByName": None,
        "postedAt": None,
        "cancelledAt": "2026-11-02T01:00:00Z",
        "createdAt": "2026-11-01T01:00:00Z",
        "updatedAt": "2026-11-02T01:00:00Z",
    }
    item = ChainItem.model_validate({**base, "cancelReason": "Sai số lượng"})
    assert DocumentChain(items=[item]).model_dump(mode="json")["items"][0]["cancelReason"] == (
        "Sai số lượng"
    )
    with pytest.raises(ValidationError):
        ChainItem.model_validate(base)  # cancelReason is required (nullable)
    with pytest.raises(ValidationError):
        ChainItem.model_validate({**base, "cancelReason": None, "code": "TH-1"})


@pytest.mark.parametrize(
    "allowed,expected",
    [
        (ANY_READ, KINDS),
        (("reports.read",), KINDS),
        (("product.manage",), ("STOCK_RECEIPT",)),
        (("sales.read",), ("STOCK_ISSUE",)),
        (("debt.read",), ("STOCK_ISSUE", "PAYMENT_RECEIPT")),
        (("payments.online", "stock.receipt.post"), ("STOCK_RECEIPT", "PAYMENT_RECEIPT")),
        (("agency.read", "audit.read"), ()),
        ((), ()),
    ],
)
def test_readable_kinds(allowed, expected):
    assert service(allowed).readable_kinds == expected


def test_readable_kinds_are_computed_once():
    calls = []
    history = DocumentHistoryService(
        MagicMock(),
        CursorCodec(b"h" * 32),
        1,
        "request",
        lambda _: None,
        allowed_functions=lambda: calls.append(1) or ("debt.read",),
    )
    assert history.readable_kinds == history.readable_kinds and calls == [1]


def test_search_rejects_before_querying():
    session = MagicMock()
    with pytest.raises(AuthError) as error:
        service(("sales.read",), session).search(kind="STOCK_RECEIPT")
    assert error.value.status == 403
    with pytest.raises(AuthError):
        service((), session).search()
    with pytest.raises(ApiError) as invalid:
        service(session=session).search(fromDate=date(2026, 11, 2), toDate=date(2026, 11, 2))
    assert invalid.value.status == 422
    session.execute.assert_not_called()


def test_get_missing_and_forbidden_documents():
    history = service(("sales.read",))
    history.repo = MagicMock()
    history.repo.document.return_value = None
    with pytest.raises(ApiError) as missing:
        history.get(5)
    assert missing.value.status == 404 and missing.value.code == "NOT_FOUND"
    history.repo.document.return_value = {"id": 5, "kind": "STOCK_RECEIPT"}
    with pytest.raises(AuthError) as denied:
        history.get(5)
    assert denied.value.status == 403
    with pytest.raises(AuthError):
        history.chain(5)
    history.repo.chain_ids.assert_not_called()
