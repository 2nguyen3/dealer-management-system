from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.modules.document_corrections.goods import GoodsCorrectionService
from app.modules.stock_adjustments.schemas import StockAdjustmentCorrection
from app.modules.stock_adjustments.service import StockAdjustmentService
from app.modules.stock_receipts.schemas import Reason, StockReceiptCorrection
from app.modules.stock_receipts.service import StockReceiptService


def service(session, actor, kind="STOCK_RECEIPT", authorize=lambda _: None):
    owner = StockReceiptService if kind == "STOCK_RECEIPT" else StockAdjustmentService
    return GoodsCorrectionService(
        owner(session, CursorCodec(b"x" * 32), actor, "m29-goods", authorize), kind
    )


def replacement(product, *, kind="STOCK_RECEIPT", quantity="3", day="2026-10-01", **values):
    model = StockReceiptCorrection if kind == "STOCK_RECEIPT" else StockAdjustmentCorrection
    line = {"productId": product, "quantity": quantity}
    if kind == "STOCK_RECEIPT":
        line["unitPrice"] = "300"
    return model.model_validate(
        {"businessDate": day, "reason": "Recorded quantity error", "lines": [line], **values}
    )


def apply(engine, actor, identifier, body, condition, *, kind="STOCK_RECEIPT", key=None):
    with Session(engine) as session:
        use_case = service(session, actor, kind)
        return use_case.correct(identifier, body, condition, key or uuid4())


def cancel(engine, actor, identifier, condition, *, kind="STOCK_RECEIPT", key=None):
    with Session(engine) as session:
        return service(session, actor, kind).cancel_document(
            identifier, Reason(reason="Recorded in error"), condition, key or uuid4()
        )


def condition(client, path):
    detail = client.get(path)
    assert detail.status_code == 200, detail.text
    return Preconditions(detail.headers["ETag"])


def snapshot(engine):
    tables = (
        "document",
        "document_revision",
        "document_line",
        "posting_batch",
        "inventory_entry",
        "inventory_balance",
        "agency_balance",
        "receivable_entry",
        "credit_entry",
        "credit_lot",
        "refund_reservation",
        "refund_attempt",
        "online_payment",
        "payment_event",
        "upfront_confirmation",
        "audit_log",
        "api_idempotency",
    )
    with engine.connect() as connection:
        return {
            table: connection.execute(text(f"SELECT * FROM dms.{table} ORDER BY 1"))
            .mappings()
            .all()
            for table in tables
        }
