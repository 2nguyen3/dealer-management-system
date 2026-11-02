from sqlalchemy import text

from app.core.exceptions import ApiError
from app.modules.document_core.list_repository import FinancialDocumentRepository
from app.modules.document_core.models import REVISION


class StockIssueRepository(FinancialDocumentRepository):
    kind = "STOCK_ISSUE"
    columns = {
        **FinancialDocumentRepository.columns,
        "remainingAtIssue": REVISION.c.totalAmount - REVISION.c.immediatePayment,
    }

    def check_stock(self, lines, business_date):
        for line in lines:
            minimum = self.session.scalar(
                text("""
                WITH checkpoints AS (
                  SELECT "businessDate","businessOrder",sum(quantity) AS delta
                  FROM dms.inventory_entry WHERE "productId"=:product
                  GROUP BY "businessDate","businessOrder"
                ), balances AS (
                  SELECT *,sum(delta) OVER (ORDER BY "businessDate","businessOrder") AS stock
                  FROM checkpoints
                ) SELECT least(
                  coalesce((SELECT sum(delta) FROM checkpoints WHERE "businessDate"<=:day),0),
                  coalesce((SELECT min(stock) FROM balances WHERE "businessDate">:day),
                    (SELECT coalesce(sum(delta),0) FROM checkpoints)))
            """),
                {"product": int(line["productId"]), "day": business_date},
            )
            if minimum < line["quantity"]:
                raise ApiError(409, "INSUFFICIENT_STOCK", "Issue would make stock negative")
