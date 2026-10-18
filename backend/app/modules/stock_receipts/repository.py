from operator import ge, lt
from types import SimpleNamespace

from sqlalchemy import Numeric, String, cast, exists, func, literal, select

from app.modules.document_core.models import DOCUMENT, LINE, REVISION


def contains_product(revision_column, product_id):
    return exists(
        select(LINE.c.id).where(
            LINE.c.revisionId == revision_column, LINE.c.productId == int(product_id)
        )
    )


class StockReceiptRepository:
    model = SimpleNamespace(id=DOCUMENT.c.id)
    columns = {
        "id": DOCUMENT.c.id,
        "code": DOCUMENT.c.code,
        "kind": DOCUMENT.c.kind,
        "agencyId": cast(DOCUMENT.c.agencyId, String),
        "agencyName": REVISION.c.agencyName,
        "originDocumentId": cast(DOCUMENT.c.originDocumentId, String),
        "receiptType": DOCUMENT.c.receiptType,
        "status": DOCUMENT.c.status,
        "revisionNo": REVISION.c.revisionNo,
        "businessDate": REVISION.c.businessDate,
        "totalAmount": REVISION.c.totalAmount,
        "immediatePayment": REVISION.c.immediatePayment,
        "remainingAtIssue": cast(literal(None), Numeric),
        "paymentMethod": REVISION.c.paymentMethod,
        "outstandingAmount": cast(literal(None), Numeric),
        "settlementStatus": literal(None, String),
        "createdAt": DOCUMENT.c.createdAt,
        "updatedAt": DOCUMENT.c.updatedAt,
        "note": REVISION.c.note,
        "snapshotNames": select(func.string_agg(LINE.c.productName + " " + LINE.c.unitName, " "))
        .where(LINE.c.revisionId == REVISION.c.id)
        .scalar_subquery(),
    }
    ranges = {
        "fromDate": (REVISION.c.businessDate, ge),
        "toDate": (REVISION.c.businessDate, lt),
        "productId": (REVISION.c.id, contains_product),
    }

    def __init__(self, session):
        self.session = session

    def query(self):
        return (
            select(
                cast(DOCUMENT.c.id, String).label("id"),
                *(
                    column.label(name)
                    for name, column in self.columns.items()
                    if name not in ("id", "note", "snapshotNames")
                ),
            )
            .select_from(DOCUMENT.join(REVISION, REVISION.c.id == DOCUMENT.c.currentRevisionId))
            .where(DOCUMENT.c.kind == "STOCK_RECEIPT")
        )
