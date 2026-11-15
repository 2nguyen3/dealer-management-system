from sqlalchemy import text

from app.modules.reports.repository import ReportQueries


class ChatbotRepository:
    """Read-only lookups for the semantic engine. Callers own the read transaction."""

    def __init__(self, session):
        self.session = session

    def _rows(self, sql: str) -> list[dict]:
        return [dict(row) for row in self.session.execute(text(sql)).mappings()]

    def now(self):
        return self.session.execute(text("SELECT statement_timestamp()")).scalar_one()

    def agencies(self) -> list[dict]:
        """Every agency (terminated ones still resolve for historical reports)."""
        return self._rows(
            'SELECT a.id, a.code, a.name, a.status, a."typeId", a."wardId", a.debt, '
            'w.name AS "wardName" FROM dms.agency a JOIN dms.ward w ON w.id = a."wardId" '
            "ORDER BY a.id"
        )

    def products(self) -> list[dict]:
        return self._rows(
            'SELECT p.id, p.code, p.name, p.status, p.stock, u.name AS "unitName" '
            'FROM dms.product p JOIN dms.unit u ON u.id = p."unitId" ORDER BY p.id'
        )

    def wards(self) -> list[dict]:
        return self._rows("SELECT id, code, name FROM dms.ward ORDER BY id")

    def agency_types(self) -> list[dict]:
        return self._rows("SELECT id, code, name FROM dms.agency_type ORDER BY id")

    def report(self, kind: str, from_date, to_date, filters: dict) -> dict:
        return ReportQueries(self.session).read(kind, from_date, to_date, filters)
