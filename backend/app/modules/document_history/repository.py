from sqlalchemy import String, case, cast, select

from app.modules.document_core.list_repository import AGENCY, INVOICE, FinancialDocumentRepository
from app.modules.document_core.models import DOCUMENT, REVISION


class HistoryRepository(FinancialDocumentRepository):
    columns = {
        **FinancialDocumentRepository.columns,
        "remainingAtIssue": case(
            (
                DOCUMENT.c.kind == "STOCK_ISSUE",
                REVISION.c.totalAmount - REVISION.c.immediatePayment,
            ),
            else_=None,
        ),
    }
    ranges = {
        **FinancialDocumentRepository.ranges,
        "authorizedKinds": (DOCUMENT.c.kind, lambda column, kinds: column.in_(kinds)),
    }

    def query(self):
        return select(
            cast(DOCUMENT.c.id, String).label("id"),
            *(
                value.label(name)
                for name, value in self.columns.items()
                if name not in ("id", "note", "snapshotNames")
            ),
        ).select_from(
            DOCUMENT.join(REVISION, REVISION.c.id == DOCUMENT.c.currentRevisionId)
            .outerjoin(AGENCY, AGENCY.c.id == DOCUMENT.c.agencyId)
            .outerjoin(INVOICE, INVOICE.c.issueDocumentId == DOCUMENT.c.id)
        )
