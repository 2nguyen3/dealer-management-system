from decimal import Decimal

from sqlalchemy import text

DRAFT_KINDS = {
    "stockReceipts": "STOCK_RECEIPT",
    "stockIssues": "STOCK_ISSUE",
    "paymentReceipts": "PAYMENT_RECEIPT",
}


class DashboardRepository:
    """Read-only aggregates over POSTED documents and current balance columns."""

    def __init__(self, session):
        self.session = session

    def one(self, sql, parameters=None):
        return dict(self.session.execute(text(sql), parameters or {}).mappings().one())

    def all(self, sql, parameters=None):
        return [dict(row) for row in self.session.execute(text(sql), parameters or {}).mappings()]

    def agencies(self):
        return self.one("""
            SELECT count(*) AS total, count(*) FILTER (WHERE status='ACTIVE') AS active
            FROM dms.agency
        """)

    def sales(self, bounds, months):
        rows = self.all(
            """
            SELECT to_char(d."businessDate",'YYYY-MM') AS month,
              coalesce(sum(d."totalAmount"),0) AS "salesAmount", count(*) AS "issueCount"
            FROM dms.document d
            WHERE d.kind='STOCK_ISSUE' AND d.status='POSTED'
              AND d."businessDate">=CAST(:trendStart AS date)
              AND d."businessDate"<CAST(:end AS date)
            GROUP BY to_char(d."businessDate",'YYYY-MM')
        """,
            bounds,
        )
        by_month = {row["month"]: row for row in rows}
        trend = [
            {
                "month": month,
                "salesAmount": by_month.get(month, {}).get("salesAmount", Decimal(0)),
                "issueCount": by_month.get(month, {}).get("issueCount", 0),
            }
            for month in months
        ]
        products = self.all(
            """
            WITH amounts AS (
              SELECT l."productId", count(DISTINCT d.id) AS "numberOfIssues",
                sum(l.quantity) AS "soldQuantity", sum(l."lineAmount") AS "salesAmount"
              FROM dms.document d JOIN dms.document_line l ON l."documentId"=d.id
              WHERE d.kind='STOCK_ISSUE' AND d.status='POSTED'
                AND d."businessDate">=CAST(:start AS date)
                AND d."businessDate"<CAST(:end AS date)
              GROUP BY l."productId"
            ) SELECT a."productId"::text AS "productId", p.code AS "productCode",
              p.name AS "productName", p."unitId", u.name AS "unitName",
              a."numberOfIssues", a."soldQuantity", a."salesAmount"
            FROM amounts a JOIN dms.product p ON p.id=a."productId"
              JOIN dms.unit u ON u.id=p."unitId"
            ORDER BY a."salesAmount" DESC, a."productId" ASC LIMIT 10
        """,
            bounds,
        )
        current = trend[-1]
        return {
            "salesAmount": current["salesAmount"],
            "issueCount": current["issueCount"],
            "monthlyTrend": trend,
            "topProducts": products,
        }

    def collections(self, bounds):
        return self.one(
            """
            SELECT count(*) AS "receiptCount",
              coalesce(sum("totalAmount"),0) AS "totalAmount",
              coalesce(sum("totalAmount") FILTER (WHERE "receiptType"='CASH'),0) AS "cashAmount",
              coalesce(sum("totalAmount") FILTER (WHERE "receiptType"='BANK_TRANSFER'),0)
                AS "bankTransferAmount",
              coalesce(sum("totalAmount") FILTER (WHERE "receiptType"='ONLINE'),0)
                AS "onlineAmount"
            FROM dms.document
            WHERE kind='PAYMENT_RECEIPT' AND status='POSTED'
              AND "businessDate">=CAST(:start AS date) AND "businessDate"<CAST(:end AS date)
        """,
            bounds,
        )

    def debt(self):
        result = self.one("""
            SELECT coalesce(sum(debt) FILTER (WHERE debt>0),0) AS "totalDebt",
              coalesce(-sum(debt) FILTER (WHERE debt<0),0) AS "prepaidAmount",
              count(*) FILTER (WHERE debt>0) AS "agenciesInDebt"
            FROM dms.agency
        """)
        # Nearest to (or over) the limit first; a zero limit with debt is always over it.
        result["topAgencies"] = self.all("""
            SELECT a.id::text AS "agencyId", a.code AS "agencyCode", a.name AS "agencyName",
              a.debt, t."maxDebt",
              CASE WHEN t."maxDebt">0 THEN round(a.debt*100/t."maxDebt",2) END AS "debtRatio"
            FROM dms.agency a JOIN dms.agency_type t ON t.id=a."typeId"
            WHERE a.debt>0
            ORDER BY (t."maxDebt"=0) DESC, a.debt/nullif(t."maxDebt",0) DESC, a.debt DESC, a.id
            LIMIT 10
        """)
        return result

    def drafts(self, sections):
        counts = dict(
            self.session.execute(
                text("SELECT kind, count(*) FROM dms.document WHERE status='DRAFT' GROUP BY kind")
            ).all()
        )
        return {key: counts.get(DRAFT_KINDS[key], 0) for key in sections}
