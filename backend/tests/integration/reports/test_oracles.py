"""Independent expected datasets, without assuming unimplemented ReportQueries signatures.

Every helper returns the entire filtered population, never a cursor-limited page.
No helper calls production report functions, balance writers or report endpoints.
"""

from decimal import Decimal, localcontext

from sqlalchemy import text


def rows(connection, sql, **parameters):
    return [dict(row) for row in connection.execute(text(sql), parameters).mappings()]


def full_totals(items, fields):
    """Exact sums of every filtered row, including empty and >28-digit populations."""
    with localcontext() as context:
        values = [Decimal(row[field]) for row in items for field in fields]
        context.prec = (
            max((value.adjusted() + 1 for value in values), default=1)
            + max((-value.as_tuple().exponent for value in values), default=0)
            + len(str(len(items)))
            + 16
        )
        return {field: sum((row[field] for row in items), Decimal(0)) for field in fields}


def sales_oracle(connection, start, end, *, agency_id=None, type_id=None):
    items = rows(
        connection,
        """
        WITH facts AS (
          SELECT d."agencyId",d.kind,r."totalAmount" FROM dms.document d
          JOIN dms.document_revision r ON r.id=d."currentRevisionId"
          WHERE d.status='POSTED' AND d.kind IN ('STOCK_ISSUE','SALES_RETURN')
          AND r."businessDate">=:start AND r."businessDate"<:end),
        grouped AS (SELECT "agencyId",
          count(*) FILTER(WHERE kind='STOCK_ISSUE') AS "issueCount",
          coalesce(sum("totalAmount") FILTER(WHERE kind='STOCK_ISSUE'),0) AS "salesAmount",
          coalesce(sum("totalAmount") FILTER(WHERE kind='SALES_RETURN'),0) AS "returnAmount"
          FROM facts GROUP BY "agencyId")
        SELECT g.*,a.name AS "agencyName",g."salesAmount"-g."returnAmount" AS "netSalesAmount"
        FROM grouped g JOIN dms.agency a ON a.id=g."agencyId"
        WHERE (CAST(:agency AS bigint) IS NULL OR a.id=:agency)
        AND (CAST(:type AS bigint) IS NULL OR a."typeId"=:type) ORDER BY a.id
    """,
        start=start,
        end=end,
        agency=agency_id,
        type=type_id,
    )
    company = connection.scalar(
        text("""
        SELECT coalesce(sum(r."totalAmount"),0) FROM dms.document d
        JOIN dms.document_revision r ON r.id=d."currentRevisionId"
        WHERE d.kind='STOCK_ISSUE' AND d.status='POSTED'
        AND r."businessDate">=:start AND r."businessDate"<:end
    """),
        {"start": start, "end": end},
    )
    return {
        "rows": items,
        "companyGrossSales": company,
        "totals": full_totals(
            items, ("issueCount", "salesAmount", "returnAmount", "netSalesAmount")
        ),
    }


def ledger_oracle(connection, ledger, start, end, *, agency_id=None):
    """Signed effective-date components retain originals AND opposite reversal entries."""
    if ledger not in ("receivable", "credit"):
        raise ValueError("Only financial ledgers are supported")
    return rows(
        connection,
        f"""
        SELECT "agencyId",kind,
          coalesce(sum(amount) FILTER(WHERE "businessDate"<:start),0) AS opening,
          coalesce(sum(amount) FILTER(WHERE "businessDate">=:start
            AND "businessDate"<:end),0) AS movement,
          coalesce(sum(amount) FILTER(WHERE "businessDate"<:end),0) AS closing
        FROM dms.{ledger}_entry WHERE (CAST(:agency AS bigint) IS NULL OR "agencyId"=:agency)
        GROUP BY "agencyId",kind ORDER BY "agencyId",kind
    """,
        start=start,
        end=end,
        agency=agency_id,
    )


def inventory_oracle(connection, start, end, *, product_id=None):
    return rows(
        connection,
        """
        SELECT p.id AS "productId",p.name AS "productName",p."unitId",
          coalesce(sum(e.quantity) FILTER(WHERE e."businessDate"<:start),0) AS "openingStock",
          coalesce(sum(e.quantity) FILTER(WHERE e."businessDate">=:start
            AND e."businessDate"<:end AND d.kind='STOCK_RECEIPT'),0) AS "receivedQuantity",
          -coalesce(sum(e.quantity) FILTER(WHERE e."businessDate">=:start
            AND e."businessDate"<:end AND d.kind='STOCK_ISSUE'),0) AS "issuedQuantity",
          coalesce(sum(e.quantity) FILTER(WHERE e."businessDate">=:start
            AND e."businessDate"<:end AND d.kind='SALES_RETURN'),0) AS "returnedQuantity",
          coalesce(sum(e.quantity) FILTER(WHERE e."businessDate">=:start
            AND e."businessDate"<:end AND d.kind='STOCK_ADJUSTMENT'),0) AS "adjustedQuantity",
          coalesce(sum(e.quantity) FILTER(WHERE e."businessDate"<:end),0) AS "closingStock"
        FROM dms.product p LEFT JOIN dms.inventory_entry e ON e."productId"=p.id
        LEFT JOIN dms.posting_batch b ON b.id=e."batchId"
        LEFT JOIN dms.document_revision r ON r.id=b."revisionId"
        LEFT JOIN dms.document d ON d.id=r."documentId"
        WHERE (CAST(:product AS bigint) IS NULL OR p.id=:product)
        GROUP BY p.id ORDER BY p.id
    """,
        start=start,
        end=end,
        product=product_id,
    )


def product_sales_oracle(connection, start, end, *, agency_id=None, product_id=None):
    items = rows(
        connection,
        """
        SELECT l."productId",l."unitId",p.name AS "productName",
          coalesce(sum(l.quantity) FILTER(WHERE d.kind='STOCK_ISSUE'),0) AS "soldQuantity",
          coalesce(sum(l.quantity) FILTER(WHERE d.kind='SALES_RETURN'),0) AS "returnedQuantity",
          coalesce(sum(l."lineAmount") FILTER(WHERE d.kind='STOCK_ISSUE'),0) AS "salesAmount",
          coalesce(sum(l."lineAmount") FILTER(WHERE d.kind='SALES_RETURN'),0) AS "returnAmount",
          coalesce(sum(CASE WHEN d.kind='STOCK_ISSUE' THEN l."lineAmount"
            ELSE -l."lineAmount" END),0) AS "netSalesAmount"
        FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
        JOIN dms.document_line l ON l."revisionId"=r.id JOIN dms.product p ON p.id=l."productId"
        WHERE d.status='POSTED' AND d.kind IN ('STOCK_ISSUE','SALES_RETURN')
        AND r."businessDate">=:start AND r."businessDate"<:end
        AND (CAST(:agency AS bigint) IS NULL OR d."agencyId"=:agency)
        AND (CAST(:product AS bigint) IS NULL OR l."productId"=:product)
        GROUP BY l."productId",l."unitId",p.name ORDER BY l."productId",l."unitId"
    """,
        start=start,
        end=end,
        agency=agency_id,
        product=product_id,
    )
    return {
        "rows": items,
        "totals": full_totals(items, ("salesAmount", "returnAmount", "netSalesAmount")),
    }


def cash_oracle(connection, start, end, *, agency_id=None):
    """Independent scans avoid raw receipt x lot x reservation fanout."""
    cash = rows(
        connection,
        """
        SELECT d."agencyId",d.kind,sum(r."totalAmount") AS amount FROM dms.document d
        JOIN dms.document_revision r ON r.id=d."currentRevisionId"
        WHERE d.status='POSTED' AND d.kind IN ('PAYMENT_RECEIPT','REFUND')
        AND r."businessDate">=:start AND r."businessDate"<:end
        AND (CAST(:agency AS bigint) IS NULL OR d."agencyId"=:agency)
        GROUP BY d."agencyId",d.kind ORDER BY d."agencyId",d.kind
    """,
        start=start,
        end=end,
        agency=agency_id,
    )
    reserved = rows(
        connection,
        """
        SELECT l."agencyId",sum(x.amount) AS reserved FROM dms.refund_reservation x
        JOIN dms.credit_lot l ON l.id=x."lotId" WHERE x.state='ACTIVE'
        AND (CAST(:agency AS bigint) IS NULL OR l."agencyId"=:agency)
        GROUP BY l."agencyId" ORDER BY l."agencyId"
    """,
        agency=agency_id,
    )
    current = rows(
        connection,
        """
        SELECT "agencyId",sum(amount) AS credit FROM dms.credit_entry
        WHERE (CAST(:agency AS bigint) IS NULL OR "agencyId"=:agency)
        GROUP BY "agencyId" ORDER BY "agencyId"
    """,
        agency=agency_id,
    )
    evidence = rows(
        connection,
        """
        SELECT d."agencyId",sum(u.amount) AS unapplied FROM dms.upfront_confirmation u
        JOIN dms.document_revision r ON r.id=u."issueRevisionId"
        JOIN dms.document d ON d.id=r."documentId"
        WHERE u.state='VERIFIED' AND u."receiptDocumentId" IS NULL
        AND u."receivedAt">=(CAST(:start AS date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND u."receivedAt"<(CAST(:end AS date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND (CAST(:agency AS bigint) IS NULL OR d."agencyId"=:agency)
        GROUP BY d."agencyId" ORDER BY d."agencyId"
    """,
        start=start,
        end=end,
        agency=agency_id,
    )
    return {
        "cash": cash,
        "periodCredit": ledger_oracle(connection, "credit", start, end, agency_id=agency_id),
        "currentCredit": current,
        "activeReservations": reserved,
        "verifiedUnapplied": evidence,
    }


def cash_rows(connection, start, end, *, agency_id=None):
    scans = cash_oracle(connection, start, end, agency_id=agency_id)
    result = {}

    def row(agency):
        return result.setdefault(
            agency,
            dict.fromkeys(
                (
                    "cashReceived",
                    "cashRefunded",
                    "verifiedUnreceiptedAmount",
                    "openingCredit",
                    "creditCreated",
                    "creditApplied",
                    "creditRefunded",
                    "closingCredit",
                    "currentReservedCredit",
                    "currentAvailableCredit",
                ),
                Decimal(0),
            ),
        )

    for entry in scans["cash"]:
        field = "cashReceived" if entry["kind"] == "PAYMENT_RECEIPT" else "cashRefunded"
        row(entry["agencyId"])[field] += entry["amount"]
    for entry in scans["periodCredit"]:
        target = row(entry["agencyId"])
        target["openingCredit"] += entry["opening"]
        target["closingCredit"] += entry["closing"]
        field, sign = {
            "CREATED": ("creditCreated", 1),
            "OFFSET": ("creditApplied", -1),
            "REFUND": ("creditRefunded", -1),
        }[entry["kind"]]
        target[field] += sign * entry["movement"]
    for entry in scans["currentCredit"]:
        row(entry["agencyId"])["currentAvailableCredit"] += entry["credit"]
    for entry in scans["activeReservations"]:
        target = row(entry["agencyId"])
        target["currentReservedCredit"] += entry["reserved"]
        target["currentAvailableCredit"] -= entry["reserved"]
    for entry in scans["verifiedUnapplied"]:
        row(entry["agencyId"])["verifiedUnreceiptedAmount"] += entry["unapplied"]
    return {agency: values for agency, values in result.items() if any(values.values())}
