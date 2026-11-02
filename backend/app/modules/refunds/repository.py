from operator import eq

from sqlalchemy import BigInteger, String, column, select, table

from app.modules.document_core.list_repository import FinancialDocumentRepository
from app.modules.document_core.models import REVISION

ATTEMPT = table(
    "refund_attempt",
    column("id", BigInteger),
    column("refundRevisionId", BigInteger),
    column("state", String),
    schema="dms",
)


class RefundRepository(FinancialDocumentRepository):
    kind = "REFUND"
    ranges = {
        **FinancialDocumentRepository.ranges,
        "attemptState": (
            select(ATTEMPT.c.state)
            .where(ATTEMPT.c.refundRevisionId == REVISION.c.id)
            .order_by(ATTEMPT.c.id.desc())
            .limit(1)
            .correlate(REVISION)
            .scalar_subquery(),
            eq,
        ),
    }
