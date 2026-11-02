from sqlalchemy import BigInteger, Numeric, String, cast, column, func, select, table

from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.stock_receipts.repository import StockReceiptRepository

INVOICE = table(
    "invoice_balance",
    column("issueDocumentId", BigInteger),
    column("outstandingAmount", Numeric),
    column("settlementStatus", String),
    schema="dms",
)
AGENCY = table("agency", column("id", BigInteger), column("name", String), schema="dms")


class FinancialDocumentRepository(StockReceiptRepository):
    columns = {
        **StockReceiptRepository.columns,
        "agencyName": func.coalesce(REVISION.c.agencyName, AGENCY.c.name),
        "outstandingAmount": INVOICE.c.outstandingAmount,
        "settlementStatus": INVOICE.c.settlementStatus,
    }

    def query(self):
        return (
            select(
                cast(DOCUMENT.c.id, String).label("id"),
                *(
                    value.label(name)
                    for name, value in self.columns.items()
                    if name not in ("id", "note", "snapshotNames")
                ),
            )
            .select_from(
                DOCUMENT.join(REVISION, REVISION.c.id == DOCUMENT.c.currentRevisionId)
                .join(AGENCY, AGENCY.c.id == DOCUMENT.c.agencyId)
                .outerjoin(INVOICE, INVOICE.c.issueDocumentId == DOCUMENT.c.id)
            )
            .where(DOCUMENT.c.kind == self.kind)
        )
