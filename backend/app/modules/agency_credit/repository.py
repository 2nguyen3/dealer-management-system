from sqlalchemy import text

from app.core.exceptions import ApiError

LOT_QUERY = '''SELECT l.id::text,l."agencyId"::text,r."documentId"::text AS "sourceDocumentId",
    l."sourceRevisionId"::text,l."originReceiptId"::text,l.balance,l.reserved,l.available,
    l."createdAt",l."updatedAt" FROM dms.credit_availability l
    JOIN dms.document_revision r ON r.id=l."sourceRevisionId"'''


class CreditRepository:
    def __init__(self, session):
        self.session = session

    def agency(self, identifier):
        if (
            self.session.scalar(text("SELECT id FROM dms.agency WHERE id=:id"), {"id": identifier})
            is None
        ):
            raise ApiError(404, "NOT_FOUND", "Agency not found")

    def lot(self, identifier):
        row = (
            self.session.execute(text(LOT_QUERY + " WHERE l.id=:id"), {"id": identifier})
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Credit lot not found")
        return dict(row)

    def lots(self, agency_id, sort, parameters):
        descending = sort.startswith("-")
        comparison, direction = ("<", "DESC") if descending else (">", "ASC")
        order = (
            "l.id " + direction
            if sort.removeprefix("-") == "id"
            else 'l."createdAt" ' + direction + ",l.id " + direction
        )
        boundary = (
            "l.id " + comparison + " CAST(:anchor AS bigint)"
            if sort.removeprefix("-") == "id"
            else '(l."createdAt",l.id) '
            + comparison
            + " (CAST(:time AS timestamptz),CAST(:anchor AS bigint))"
        )
        return [
            dict(row)
            for row in self.session.execute(
                text(
                    LOT_QUERY
                    + f"""
            WHERE l."agencyId"=:agency
            AND (CAST(:receipt AS bigint) IS NULL OR l."originReceiptId"=:receipt)
            AND (NOT :available OR l.available>0)
            AND (CAST(:anchor AS bigint) IS NULL OR {boundary}) ORDER BY {order} LIMIT :fetch
        """
                ),
                {"agency": agency_id, **parameters},
            ).mappings()
        ]

    def statement(self, agency_id, descending, parameters):
        direction, comparison = ("DESC", "<") if descending else ("ASC", ">")
        row = (
            self.session.execute(
                text(f"""
            WITH ledger AS (
              SELECT e.*,d.id AS "sourceDocumentId",d.code AS "sourceDocumentCode",
                r."revisionNo" AS "sourceRevisionNo",
                e."reversesEntryId" IS NULL AND NOT EXISTS(SELECT 1 FROM dms.credit_entry x
                  WHERE x."reversesEntryId"=e.id) AS "isEffective",
                sum(e.amount) OVER(ORDER BY e."businessDate",e."businessOrder"
                  RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "balanceAfter"
              FROM dms.credit_entry e JOIN dms.posting_batch b ON b.id=e."batchId"
              JOIN dms.document_revision r ON r.id=b."revisionId"
              JOIN dms.document d ON d.id=r."documentId" WHERE e."agencyId"=:agency
            ), page AS (
              SELECT *,jsonb_build_object('id',id::text,'sourceDocumentId',"sourceDocumentId"::text,
                'sourceDocumentCode',"sourceDocumentCode",'sourceRevisionNo',"sourceRevisionNo",
                'businessDate',"businessDate",'businessOrder',"businessOrder"::text,
                'reversesEntryId',"reversesEntryId"::text,'isEffective',"isEffective",
                'createdAt',"createdAt",'agencyId',"agencyId"::text,'lotId',"lotId"::text,
                'kind',kind,'amountDelta',amount::text,'balanceAfter',"balanceAfter"::text) AS data
              FROM ledger WHERE (CAST(:fromDate AS date) IS NULL OR "businessDate">=:fromDate)
              AND (CAST(:toDate AS date) IS NULL OR "businessDate"<:toDate)
              AND (CAST(:lotId AS bigint) IS NULL OR "lotId"=:lotId)
              AND (CAST(:sourceDocumentId AS bigint) IS NULL
                OR "sourceDocumentId"=:sourceDocumentId)
              AND (CAST(:kind AS text) IS NULL OR kind=:kind)
              AND (NOT :effectiveOnly OR "isEffective")
              AND (CAST(:cursorDate AS date) IS NULL OR ("businessDate","businessOrder",id)
                {comparison} (CAST(:cursorDate AS date),CAST(:cursorOrder AS bigint),
                  CAST(:cursorId AS bigint)))
              ORDER BY "businessDate" {direction},"businessOrder" {direction},id {direction}
              LIMIT :fetch
            ) SELECT a.id::text AS "agencyId",
              coalesce((SELECT sum(amount) FROM ledger
                WHERE "businessDate"<:fromDate),0) AS "openingCredit",
              coalesce((SELECT sum(amount) FROM ledger WHERE CAST(:toDate AS date) IS NULL
                OR "businessDate"<:toDate),0) AS "closingCredit",
              coalesce((SELECT jsonb_agg(data ORDER BY "businessDate" {direction},
                "businessOrder" {direction},id {direction}) FROM page),'[]'::jsonb) AS items
            FROM dms.agency a WHERE a.id=:agency
        """),
                {"agency": agency_id, **parameters},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Agency not found")
        return dict(row)
