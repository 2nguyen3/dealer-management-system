from sqlalchemy import String, cast, select

from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.stock_receipts.repository import StockReceiptRepository


class StockAdjustmentRepository(StockReceiptRepository):
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
            .where(DOCUMENT.c.kind == "STOCK_ADJUSTMENT")
        )
