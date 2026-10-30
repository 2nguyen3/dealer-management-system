from sqlalchemy import text

from app.modules.reports.queries import REPORT_SQL


class ReportQueries:
    """Trusted read seam: callers own authorization and the enclosing transaction."""

    def __init__(self, session):
        self.session = session

    @staticmethod
    def statement(kind):
        """Composable SELECT with metadata, including a null-row sentinel when empty."""
        return text(REPORT_SQL[kind])

    def read(self, kind, from_date, to_date, filters=None):
        parameters = dict.fromkeys(("agencyId", "productId", "typeId", "districtId"))
        parameters.update(filters or {})
        parameters = {
            key: None if value is None else int(value) for key, value in parameters.items()
        }
        parameters.update(fromDate=from_date, toDate=to_date)
        result = self.session.execute(self.statement(kind), parameters)
        try:
            records = [dict(row) for row in result.mappings()]
        finally:
            result.close()
        generated_at = records[0]["__generatedAt"]
        identifier = "productId" if kind in ("inventory", "product-sales") else "agencyId"
        rows = []
        for record in records:
            row = {key: value for key, value in record.items() if not key.startswith("__")}
            if row[identifier] is not None:
                row[identifier] = str(row[identifier])
                rows.append(row)
        detached = {"generatedAt": generated_at, "rows": rows}
        if kind == "sales":
            detached["companyGrossSales"] = records[0]["__companyGrossSales"]
        return detached

    def sales(self, from_date, to_date, filters=None):
        return self.read("sales", from_date, to_date, filters)

    def debt(self, from_date, to_date, filters=None):
        return self.read("debt", from_date, to_date, filters)

    def inventory(self, from_date, to_date, filters=None):
        return self.read("inventory", from_date, to_date, filters)

    def product_sales(self, from_date, to_date, filters=None):
        return self.read("product-sales", from_date, to_date, filters)

    def cash_and_credit(self, from_date, to_date, filters=None):
        return self.read("cash-and-credit", from_date, to_date, filters)
