from sqlalchemy import text

from app.core.exceptions import ApiError
from app.modules.document_core.list_repository import FinancialDocumentRepository


class SalesReturnRepository(FinancialDocumentRepository):
    kind = "SALES_RETURN"

    def origin(self, identifier):
        row = (
            self.session.execute(
                text("""
            SELECT d.*,r."businessDate" FROM dms.document d JOIN dms.document_revision r
            ON r.id=d."currentRevisionId" WHERE d.id=:id
        """),
                {"id": identifier},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Original issue not found")
        if row["kind"] != "STOCK_ISSUE" or row["status"] != "POSTED":
            raise ApiError(409, "RETURN_SOURCE_CONFLICT", "Return requires a posted original issue")
        return dict(row)

    def origin_line(self, origin_id, line_id):
        row = (
            self.session.execute(
                text("""
            SELECT l.* FROM dms.document_line l JOIN dms.document_revision r ON r.id=l."revisionId"
            WHERE l.id=:line AND r."documentId"=:origin AND r.state='POSTED'
        """),
                {"line": line_id, "origin": origin_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(
                409, "RETURN_SOURCE_CONFLICT", "Line is not a posted line of the original issue"
            )
        return dict(row)

    def history(self, origin_id):
        return [
            dict(row)
            for row in self.session.execute(
                text("""
            SELECT l.*,d.id AS document,r."businessDate",d."businessOrder"
            FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
            JOIN dms.document_line l ON l."revisionId"=r.id
            WHERE d."originDocumentId"=:origin AND d.kind='SALES_RETURN' AND d.status='POSTED'
            ORDER BY r."businessDate",d."businessOrder",l."lineNo"
        """),
                {"origin": origin_id},
            ).mappings()
        ]

    def agency_products(self, agency_id):
        return tuple(
            self.session.scalars(
                text("""
            SELECT DISTINCT l."productId" FROM dms.document d
            JOIN dms.document_line l ON l."revisionId"=d."currentRevisionId"
            WHERE d."agencyId"=:agency ORDER BY l."productId"
        """),
                {"agency": agency_id},
            )
        )
