from sqlalchemy import text

from app.common.pagination import CursorCodec
from app.core.request_context import set_audit_context
from app.modules.document_core.schemas import (
    PaymentReceiptInput,
    StockIssueInput,
    StockReceiptInput,
)
from app.modules.document_core.service import DocumentService
from tests.integration.catalogues.conftest import CASES


def service_for(resource, session, actor, request="race-request"):
    return CASES[resource][0](session, CursorCodec(b"x" * 32), actor, request, lambda _: None)


def install_builders(session, actor):
    """Remember the fixture actor; documents are built through DocumentService."""
    session.info["fixture_actor"] = actor
    set_audit_context(session, actor, "fixture", function_code="stock.receipt.post")


def documents(session, kind):
    return DocumentService(
        session,
        CursorCodec(b"x" * 32),
        session.info["fixture_actor"],
        "fixture",
        lambda _: None,
        kind=kind,
        embedded=True,
    )


def agency(session, ward=1, type_id=1):
    # Wards are the read-only 168-row catalogue (0010, rebuilt unchanged by 0011).
    return session.scalar(
        text(
            'INSERT INTO dms.agency (name,"typeId","wardId",email,"acceptedDate") '
            "VALUES ('Agency',:type,:ward,'agency@example.com','2026-01-01') RETURNING id"
        ),
        {"type": type_id, "ward": ward},
    )


def product(session, unit=1):
    return session.scalar(
        text("INSERT INTO dms.product (name,\"unitId\") VALUES ('Product',:unit) RETURNING id"),
        {"unit": unit},
    )


def draft(session, product_id, *, quantity="1", kind="STOCK_RECEIPT", agency_id=None, price="100"):
    line = {"productId": str(product_id), "quantity": str(quantity)}
    if kind == "STOCK_RECEIPT":
        body = StockReceiptInput.model_validate({"lines": [{**line, "unitPrice": str(price)}]})
    else:
        body = StockIssueInput.model_validate({"agencyId": str(agency_id), "lines": [line]})
    return documents(session, kind).create(body)


def post_stock(session, document_id):
    kind = session.scalar(text("SELECT kind FROM dms.document WHERE id=:id"), {"id": document_id})
    documents(session, kind).post(document_id, None)


def cancel_stock(session, document_id, reason="Nhập trùng phiếu"):
    kind = session.scalar(text("SELECT kind FROM dms.document WHERE id=:id"), {"id": document_id})
    documents(session, kind).cancel(document_id, reason, None)


def payment(session, agency_id, amount):
    """Create and post a cash payment receipt; returns its id."""
    service = documents(session, "PAYMENT_RECEIPT")
    body = PaymentReceiptInput.model_validate({"agencyId": str(agency_id), "amount": str(amount)})
    identifier = service.create(body)
    service.post(identifier, None)
    return identifier
