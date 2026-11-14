from sqlalchemy import text

from app.modules.reports.queries import IDENTITIES, REPORT_SQL

FILTERS = ("agencyId", "productId", "typeId", "wardId", "receiptType")
INTEGER_FILTERS = {"agencyId", "productId", "typeId", "wardId"}


class ReportQueries:
    """Trusted read seam: callers own authorization and the enclosing transaction."""

    def __init__(self, session):
        self.session = session

    def read(self, kind, from_date, to_date, filters=None):
        """Detached rows plus the statement instant (and company sales for BM5.1)."""
        parameters = dict.fromkeys(FILTERS)
        parameters.update(filters or {})
        parameters = {
            key: int(value) if key in INTEGER_FILTERS and value is not None else value
            for key, value in parameters.items()
        }
        parameters.update(fromDate=from_date, toDate=to_date)
        result = self.session.execute(text(REPORT_SQL[kind]), parameters)
        try:
            records = [dict(row) for row in result.mappings()]
        finally:
            result.close()
        identifier = IDENTITIES[kind]
        rows = []
        for record in records:
            row = {key: value for key, value in record.items() if not key.startswith("__")}
            if row[identifier] is None:
                continue
            if identifier != "businessDate":
                row[identifier] = str(row[identifier])
            rows.append(row)
        detached = {"generatedAt": records[0]["__generatedAt"], "rows": rows}
        if kind == "sales":
            detached["companySalesAmount"] = records[0]["__companySalesAmount"]
        return detached
