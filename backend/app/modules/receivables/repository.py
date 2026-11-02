from sqlalchemy import text

from app.core.exceptions import ApiError


class ReceivableRepository:
    def __init__(self, session):
        self.session = session

    def overview(self, field, descending, parameters):
        direction, comparison = ("DESC", "<") if descending else ("ASC", ">")
        row = (
            self.session.execute(
                text(f'''
            WITH moment AS MATERIALIZED (SELECT clock_timestamp() AS instant), base AS (
              SELECT a.id AS "agencyId",a.code AS "agencyCode",a.name AS "agencyName",
                a."typeId",a."districtId",a.status,b."currentDebt",b."currentCredit",t."maxDebt",
                coalesce(x.reserved,0) AS "reservedCredit",
                b."currentCredit"-coalesce(x.reserved,0) AS "availableCredit",
                t."maxDebt"-b."currentDebt" AS "remainingCreditLimit",
                (SELECT count(*) FROM dms.invoice_balance i WHERE i."agencyId"=a.id
                  AND i."outstandingAmount">0) AS "outstandingInvoiceCount"
              FROM dms.agency a JOIN dms.agency_balance b ON b."agencyId"=a.id
              JOIN dms.agency_type t ON t.id=a."typeId"
              LEFT JOIN LATERAL (SELECT sum(r.amount) AS reserved FROM dms.refund_reservation r
                JOIN dms.credit_lot l ON l.id=r."lotId"
                WHERE l."agencyId"=a.id AND r.state='ACTIVE') x ON true
              WHERE (CAST(:agencyId AS bigint) IS NULL OR a.id=:agencyId)
                AND (CAST(:typeId AS integer) IS NULL OR a."typeId"=:typeId)
                AND (CAST(:districtId AS integer) IS NULL OR a."districtId"=:districtId)
                AND (CAST(:status AS text) IS NULL OR a.status=:status)
                AND (CAST(:debtFrom AS numeric) IS NULL OR b."currentDebt">=:debtFrom)
                AND (CAST(:debtTo AS numeric) IS NULL OR b."currentDebt"<=:debtTo)
                AND (CAST(:q AS text) IS NULL OR a.code ILIKE :q ESCAPE '\\'
                  OR a.name ILIKE :q ESCAPE '\\')
            ), page AS (
              SELECT * FROM base WHERE CAST(:anchorId AS bigint) IS NULL OR
                ("{field}","agencyId") {comparison}
                  (CAST(:anchorValue AS numeric),CAST(:anchorId AS bigint))
              ORDER BY "{field}" {direction},"agencyId" {direction} LIMIT :fetch
            ) SELECT (SELECT instant FROM moment) AS "asOf",
              CAST(:anchorId AS bigint) IS NULL OR EXISTS(SELECT 1 FROM base
                WHERE "agencyId"=:anchorId AND "{field}"=CAST(:anchorValue AS numeric)) AS valid,
              jsonb_build_object('currentDebt',coalesce(sum("currentDebt"),0)::text,
                'currentCredit',coalesce(sum("currentCredit"),0)::text,
                'reservedCredit',coalesce(sum("reservedCredit"),0)::text,
                'availableCredit',coalesce(sum("availableCredit"),0)::text) AS totals,
              coalesce((SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object(
                'agencyId',p."agencyId"::text,'currentDebt',p."currentDebt"::text,
                'currentCredit',p."currentCredit"::text,'maxDebt',p."maxDebt"::text,
                'reservedCredit',p."reservedCredit"::text,'availableCredit',p."availableCredit"::text,
                'remainingCreditLimit',p."remainingCreditLimit"::text,
                'asOf',(SELECT instant FROM moment))
                ORDER BY p."{field}" {direction},p."agencyId" {direction})
                FROM page p),'[]'::jsonb) AS items
            FROM base
        '''),
                parameters,
            )
            .mappings()
            .one()
        )
        return dict(row)

    def invoice(self, identifier):
        row = (
            self.session.execute(
                text("""
            SELECT d.kind,d.status,i."issueDocumentId"::text AS "issueDocumentId",i.code,
              i."agencyId"::text AS "agencyId",i."businessDate",i."totalAmount",
              i."outstandingAmount",i."settlementStatus"
            FROM dms.document d LEFT JOIN dms.invoice_balance i ON i."issueDocumentId"=d.id
            WHERE d.id=:id
        """),
                {"id": identifier},
            )
            .mappings()
            .one_or_none()
        )
        if row is None or row["kind"] != "STOCK_ISSUE":
            raise ApiError(404, "NOT_FOUND", "Stock issue not found")
        result = dict(row)
        if result.pop("status") != "POSTED":
            raise ApiError(409, "STATE_CONFLICT", "Issue has no effective invoice balance")
        result.pop("kind")
        return result

    def invoices(self, agency_id, field, descending, parameters):
        direction, comparison = ("DESC", "<") if descending else ("ASC", ">")
        cast_type = "date" if field == "businessDate" else "numeric"
        row = (
            self.session.execute(
                text(f'''
            WITH filtered AS (
              SELECT * FROM dms.invoice_balance WHERE "agencyId"=:agency
                AND (CAST(:code AS text) IS NULL OR code=:code)
                AND (CAST(:settlementStatus AS text) IS NULL
                  OR "settlementStatus"=:settlementStatus)
                AND (CAST(:fromDate AS date) IS NULL OR "businessDate">=:fromDate)
                AND (CAST(:toDate AS date) IS NULL OR "businessDate"<:toDate)
            ), page AS (
              SELECT * FROM filtered WHERE CAST(:anchorId AS bigint) IS NULL OR
                ("{field}","issueDocumentId") {comparison}
                  (CAST(:anchorValue AS {cast_type}),CAST(:anchorId AS bigint))
              ORDER BY "{field}" {direction},"issueDocumentId" {direction} LIMIT :fetch
            ) SELECT a.id,
              CAST(:anchorId AS bigint) IS NULL OR EXISTS(SELECT 1 FROM filtered
                WHERE "issueDocumentId"=:anchorId
                  AND "{field}"=CAST(:anchorValue AS {cast_type})) AS valid,
              coalesce((SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object(
                'issueDocumentId',p."issueDocumentId"::text,'agencyId',p."agencyId"::text,
                'totalAmount',p."totalAmount"::text,'outstandingAmount',p."outstandingAmount"::text)
                ORDER BY p."{field}" {direction},p."issueDocumentId" {direction})
                FROM page p),'[]'::jsonb) AS items
            FROM dms.agency a WHERE a.id=:agency
        '''),
                {"agency": agency_id, **parameters},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Agency not found")
        return dict(row)

    def allocation_source(self, identifier):
        row = (
            self.session.execute(
                text('SELECT kind,"agencyId" FROM dms.document WHERE id=:id'), {"id": identifier}
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Document not found")
        if row["kind"] not in (
            "STOCK_ISSUE",
            "PAYMENT_RECEIPT",
            "SALES_RETURN",
            "CREDIT_APPLICATION",
        ):
            raise ApiError(409, "STATE_CONFLICT", "Document has no financial allocations")
        return dict(row)

    def statement(self, agency_id, descending, parameters):
        direction, comparison = ("DESC", "<") if descending else ("ASC", ">")
        row = (
            self.session.execute(
                text(f"""
            WITH ledger AS (
              SELECT e.*,d.id AS "sourceDocumentId",d.code AS "sourceDocumentCode",
                r."revisionNo" AS "sourceRevisionNo",
                e."reversesEntryId" IS NULL AND NOT EXISTS(
                  SELECT 1 FROM dms.receivable_entry x WHERE x."reversesEntryId"=e.id)
                  AS "isEffective",
                sum(e.amount) OVER (ORDER BY e."businessDate",e."businessOrder"
                  RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "balanceAfter"
              FROM dms.receivable_entry e JOIN dms.posting_batch b ON b.id=e."batchId"
                JOIN dms.document_revision r ON r.id=b."revisionId"
                JOIN dms.document d ON d.id=r."documentId" WHERE e."agencyId"=:agency
            ), page AS (
              SELECT *,jsonb_build_object('id',id::text,'sourceDocumentId',"sourceDocumentId"::text,
                'sourceDocumentCode',"sourceDocumentCode",'sourceRevisionNo',"sourceRevisionNo",
                'businessDate',"businessDate",'businessOrder',"businessOrder"::text,
                'reversesEntryId',"reversesEntryId"::text,'isEffective',"isEffective",'createdAt',"createdAt",
                'agencyId',"agencyId"::text,'issueDocumentId',"issueDocumentId"::text,
                'kind',kind,'amountDelta',amount::text,'balanceAfter',"balanceAfter"::text) AS data
              FROM ledger WHERE (CAST(:fromDate AS date) IS NULL OR "businessDate">=:fromDate)
                AND (CAST(:toDate AS date) IS NULL OR "businessDate"<:toDate)
                AND (CAST(:sourceDocumentId AS bigint) IS NULL
                  OR "sourceDocumentId"=:sourceDocumentId)
                AND (CAST(:issueDocumentId AS bigint) IS NULL OR "issueDocumentId"=:issueDocumentId)
                AND (CAST(:kind AS text) IS NULL OR kind=:kind)
                AND (NOT :allocation OR kind<>'CHARGE') AND (NOT :effectiveOnly OR "isEffective")
                AND (CAST(:cursorDate AS date) IS NULL OR ("businessDate","businessOrder",id)
                  {comparison} (CAST(:cursorDate AS date),CAST(:cursorOrder AS bigint),
                    CAST(:cursorId AS bigint)))
              ORDER BY "businessDate" {direction},"businessOrder" {direction},id {direction}
              LIMIT :fetch
            ) SELECT a.id::text AS "agencyId",
              coalesce((SELECT sum(amount) FROM ledger
                WHERE "businessDate"<:fromDate),0) AS "openingDebt",
              coalesce((SELECT sum(amount) FROM ledger WHERE CAST(:toDate AS date) IS NULL
                OR "businessDate"<:toDate),0) AS "closingDebt",
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
