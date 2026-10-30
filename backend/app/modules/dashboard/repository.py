from decimal import Decimal, localcontext

from sqlalchemy import text


class DashboardRepository:
    def __init__(self, session):
        self.session = session

    def one(self, sql, parameters=None):
        return dict(self.session.execute(text(sql), parameters or {}).mappings().one())

    def agencies(self):
        return self.one("""
            SELECT count(*) AS total, count(*) FILTER (WHERE status='ACTIVE') AS active
            FROM dms.agency
        """)

    def inventory(self, bounds):
        return self.one(
            """
            SELECT count(*) AS "productCount",
              count(*) FILTER (WHERE b."currentStock"<p."lowStockThreshold")
                AS "lowStockProductCount",
              (SELECT coalesce(sum(r."totalAmount"),0) FROM dms.document d
                JOIN dms.document_revision r ON r.id=d."currentRevisionId"
                WHERE d.kind='STOCK_RECEIPT' AND d.status='POSTED' AND r.state='POSTED'
                AND r."businessDate">=CAST(:start AS date)
                AND r."businessDate"<CAST(:end AS date)) AS "receivedAmount"
            FROM dms.product p JOIN dms.inventory_balance b ON b."productId"=p.id
        """,
            bounds,
        )

    def sales(self, bounds, months):
        rows = self.session.execute(
            text("""
            SELECT to_char(r."businessDate",'YYYY-MM') AS month,
              coalesce(sum(r."totalAmount") FILTER (WHERE d.kind='STOCK_ISSUE'),0) AS gross,
              coalesce(sum(r."totalAmount") FILTER (WHERE d.kind='SALES_RETURN'),0) AS returns
            FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
            WHERE d.status='POSTED' AND r.state='POSTED'
              AND d.kind IN ('STOCK_ISSUE','SALES_RETURN')
              AND r."businessDate">=CAST(:trendStart AS date)
              AND r."businessDate"<CAST(:end AS date)
            GROUP BY to_char(r."businessDate",'YYYY-MM')
        """),
            bounds,
        ).mappings()
        by_month = {row["month"]: row for row in rows}
        trend = []
        for month in months:
            row = by_month.get(month, {"gross": Decimal(0), "returns": Decimal(0)})
            with localcontext() as context:
                context.prec = max(
                    28,
                    len(row["gross"].as_tuple().digits) + 1,
                    len(row["returns"].as_tuple().digits) + 1,
                )
                net = row["gross"] - row["returns"]
            trend.append(dict(month=month, gross=row["gross"], returns=row["returns"], net=net))
        products = self.session.execute(
            text("""
            WITH amounts AS (
              SELECT l."productId",
                coalesce(sum(l.quantity) FILTER (WHERE d.kind='STOCK_ISSUE'),0)
                  AS "soldQuantity",
                coalesce(sum(l.quantity) FILTER (WHERE d.kind='SALES_RETURN'),0)
                  AS "returnedQuantity",
                coalesce(sum(l."lineAmount") FILTER (WHERE d.kind='STOCK_ISSUE'),0)
                  AS "salesAmount",
                coalesce(sum(l."returnAmount") FILTER (WHERE d.kind='SALES_RETURN'),0)
                  AS "returnAmount"
              FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
                JOIN dms.document_line l ON l."revisionId"=r.id
              WHERE d.status='POSTED' AND r.state='POSTED'
                AND d.kind IN ('STOCK_ISSUE','SALES_RETURN')
                AND r."businessDate">=CAST(:start AS date)
                AND r."businessDate"<CAST(:end AS date)
              GROUP BY l."productId"
            ) SELECT a."productId"::text AS "productId",p.code AS "productCode",
              p.name AS "productName",p."unitId",u.name AS "unitName",
              a."soldQuantity",a."returnedQuantity",a."salesAmount",a."returnAmount",
              a."salesAmount"-a."returnAmount" AS "netSalesAmount"
            FROM amounts a JOIN dms.product p ON p.id=a."productId"
              JOIN dms.unit u ON u.id=p."unitId"
            ORDER BY a."salesAmount" DESC,a."productId" ASC LIMIT 10
        """),
            bounds,
        ).mappings()
        return {key: value for key, value in trend[-1].items() if key != "month"} | {
            "monthlyTrend": trend,
            "topProducts": [dict(row) for row in products],
        }

    def receivables(self, bounds):
        result = self.one("""
            SELECT coalesce(sum("currentDebt"),0) AS "currentDebt",
              coalesce(sum("currentCredit"),0) AS "currentCredit" FROM dms.agency_balance
        """)
        result.update(
            self.one(
                """
            SELECT coalesce(sum(r."totalAmount") FILTER (WHERE d.kind='PAYMENT_RECEIPT'),0)
                AS "cashReceived",
              coalesce(sum(r."totalAmount") FILTER (WHERE d.kind='REFUND'),0) AS "cashRefunded"
            FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
            WHERE d.status='POSTED' AND r.state='POSTED'
              AND d.kind IN ('PAYMENT_RECEIPT','REFUND')
              AND r."businessDate">=CAST(:start AS date)
              AND r."businessDate"<CAST(:end AS date)
        """,
                bounds,
            )
        )
        result["topAgencies"] = [
            dict(row)
            for row in self.session.execute(
                text("""
            SELECT a.id::text AS "agencyId",a.code AS "agencyCode",a.name AS "agencyName",
              b."currentDebt" FROM dms.agency a
              JOIN dms.agency_balance b ON b."agencyId"=a.id WHERE b."currentDebt">0
            ORDER BY b."currentDebt" DESC,a.id ASC LIMIT 10
        """)
            ).mappings()
        ]
        return result

    def pending(self):
        return self.session.scalar(
            text("""
            SELECT count(*) FROM dms.document d
              JOIN dms.document_revision r ON r.id=d."currentRevisionId"
            WHERE d.kind='STOCK_ISSUE' AND d.status='PENDING' AND r.state='READY'
        """)
        )

    def verified(self, bounds):
        return self.session.scalar(
            text("""
            SELECT coalesce(sum(amount),0) FROM dms.upfront_confirmation
            WHERE state='VERIFIED' AND "receiptDocumentId" IS NULL
              AND "receivedAt">=CAST(:receivedStart AS timestamptz)
              AND "receivedAt"<CAST(:receivedEnd AS timestamptz)
        """),
            bounds,
        )
