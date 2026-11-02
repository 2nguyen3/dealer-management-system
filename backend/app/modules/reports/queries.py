"""Fixed, composable SQL projections. All dates and filter values are bound."""

SALES = """
WITH raw AS MATERIALIZED (
  SELECT * FROM dms.sales_report(CAST(:fromDate AS date), CAST(:toDate AS date))
), company AS (
  SELECT coalesce(sum("salesAmount"),0) AS gross FROM raw
), filtered AS (
  SELECT r.* FROM raw r JOIN dms.agency a ON a.id=r."agencyId"
  WHERE (CAST(:agencyId AS bigint) IS NULL OR a.id=:agencyId)
    AND (CAST(:typeId AS integer) IS NULL OR a."typeId"=:typeId)
)
SELECT statement_timestamp() AS "__generatedAt", company.gross AS "__companyGrossSales",
  f."agencyId", f."agencyCode", f."agencyName", f."numberOfIssues", f."salesAmount",
  -- Round the scaled integer ratio once, without numeric-division double rounding.
  CASE WHEN company.gross=0 THEN 0 ELSE
    div(2*f."salesAmount"*1000000+company.gross,2*company.gross)*0.0001
  END AS "salesRate", f."returnAmount", f."netSalesAmount"
FROM company LEFT JOIN filtered f ON true
"""

DEBT = """
WITH filtered AS (
  SELECT r.* FROM dms.debt_report(CAST(:fromDate AS date),CAST(:toDate AS date)) r
  JOIN dms.agency a ON a.id=r."agencyId"
  WHERE (CAST(:agencyId AS bigint) IS NULL OR a.id=:agencyId)
    AND (CAST(:typeId AS integer) IS NULL OR a."typeId"=:typeId)
    AND (CAST(:districtId AS integer) IS NULL OR a."districtId"=:districtId)
)
SELECT statement_timestamp() AS "__generatedAt", f.*
FROM (SELECT 1) moment LEFT JOIN filtered f ON true
"""

INVENTORY = """
WITH events AS (
  SELECT e."productId",e."unitId",e."businessDate",e."businessOrder",d.kind,
    sum(e.quantity) AS quantity
  FROM dms.inventory_entry e
  JOIN dms.posting_batch b ON b.id=e."batchId"
  JOIN dms.document_revision r ON r.id=b."revisionId"
  JOIN dms.document d ON d.id=r."documentId"
  WHERE e."businessDate"<CAST(:toDate AS date)
  GROUP BY e."productId",e."unitId",e."businessDate",e."businessOrder",d.kind
), amounts AS (
  SELECT "productId","unitId",
    coalesce(sum(quantity) FILTER(WHERE "businessDate"<CAST(:fromDate AS date)),0)
      AS "openingStock",
    coalesce(sum(quantity) FILTER(WHERE "businessDate">=CAST(:fromDate AS date)
      AND kind='STOCK_RECEIPT'),0) AS "receiptQuantity",
    -coalesce(sum(quantity) FILTER(WHERE "businessDate">=CAST(:fromDate AS date)
      AND kind='STOCK_ISSUE'),0) AS "issueQuantity",
    coalesce(sum(quantity) FILTER(WHERE "businessDate">=CAST(:fromDate AS date)
      AND kind='SALES_RETURN'),0) AS "returnQuantity",
    coalesce(sum(quantity) FILTER(WHERE "businessDate">=CAST(:fromDate AS date)
      AND kind='STOCK_ADJUSTMENT'),0) AS "adjustmentQuantity",
    sum(quantity) AS "closingStock"
  FROM events GROUP BY "productId","unitId"
), filtered AS (
  SELECT p.id AS "productId",p.code AS "productCode",p.name AS "productName",
    p."unitId",u.name AS "unitName",coalesce(a."openingStock",0) AS "openingStock",
    coalesce(a."receiptQuantity",0) AS "receiptQuantity",
    coalesce(a."issueQuantity",0) AS "issueQuantity",
    coalesce(a."returnQuantity",0) AS "returnQuantity",
    coalesce(a."adjustmentQuantity",0) AS "adjustmentQuantity",
    coalesce(a."closingStock",0) AS "closingStock"
  FROM dms.product p JOIN dms.unit u ON u.id=p."unitId"
  LEFT JOIN amounts a ON a."productId"=p.id AND a."unitId"=p."unitId"
  WHERE (CAST(:productId AS bigint) IS NULL OR p.id=:productId)
)
SELECT statement_timestamp() AS "__generatedAt",f.*
FROM (SELECT 1) moment LEFT JOIN filtered f ON true
"""

PRODUCT_SALES = """
WITH amounts AS (
  SELECT l."productId",l."unitId",
    coalesce(sum(l.quantity) FILTER(WHERE c.kind='STOCK_ISSUE'),0) AS "soldQuantity",
    coalesce(sum(l.quantity) FILTER(WHERE c.kind='SALES_RETURN'),0) AS "returnedQuantity",
    coalesce(sum(l."lineAmount") FILTER(WHERE c.kind='STOCK_ISSUE'),0) AS "salesAmount",
    coalesce(sum(l."lineAmount") FILTER(WHERE c.kind='SALES_RETURN'),0) AS "returnAmount"
  FROM dms.current_document c JOIN dms.document_line l ON l."revisionId"=c."revisionId"
  WHERE c.status='POSTED' AND c.kind IN ('STOCK_ISSUE','SALES_RETURN')
    AND c."businessDate">=CAST(:fromDate AS date) AND c."businessDate"<CAST(:toDate AS date)
    AND (CAST(:agencyId AS bigint) IS NULL OR c."agencyId"=:agencyId)
    AND (CAST(:productId AS bigint) IS NULL OR l."productId"=:productId)
  GROUP BY l."productId",l."unitId"
), filtered AS (
  SELECT a.*,p.code AS "productCode",p.name AS "productName",u.name AS "unitName",
    a."salesAmount"-a."returnAmount" AS "netSalesAmount"
  FROM amounts a JOIN dms.product p ON p.id=a."productId"
  JOIN dms.unit u ON u.id=a."unitId"
)
SELECT statement_timestamp() AS "__generatedAt",f.*
FROM (SELECT 1) moment LEFT JOIN filtered f ON true
"""

CASH_AND_CREDIT = """
WITH cash AS (
  SELECT "agencyId",
    coalesce(sum("totalAmount") FILTER(WHERE kind='PAYMENT_RECEIPT'),0) AS received,
    coalesce(sum("totalAmount") FILTER(WHERE kind='REFUND'),0) AS refunded
  FROM dms.current_document WHERE status='POSTED' AND kind IN ('PAYMENT_RECEIPT','REFUND')
    AND "businessDate">=CAST(:fromDate AS date) AND "businessDate"<CAST(:toDate AS date)
  GROUP BY "agencyId"
), credit_events AS (
  SELECT "agencyId","businessDate","businessOrder",kind,sum(amount) AS amount
  FROM dms.credit_entry GROUP BY "agencyId","businessDate","businessOrder",kind
), credit AS (
  SELECT "agencyId",
    coalesce(sum(amount) FILTER(WHERE "businessDate"<CAST(:fromDate AS date)),0) AS opening,
    coalesce(sum(amount) FILTER(WHERE "businessDate">=CAST(:fromDate AS date)
      AND "businessDate"<CAST(:toDate AS date) AND kind='CREATED'),0) AS created,
    -coalesce(sum(amount) FILTER(WHERE "businessDate">=CAST(:fromDate AS date)
      AND "businessDate"<CAST(:toDate AS date) AND kind='OFFSET'),0) AS applied,
    -coalesce(sum(amount) FILTER(WHERE "businessDate">=CAST(:fromDate AS date)
      AND "businessDate"<CAST(:toDate AS date) AND kind='REFUND'),0) AS refunded,
    coalesce(sum(amount) FILTER(WHERE "businessDate"<CAST(:toDate AS date)),0) AS closing,
    sum(amount) AS current
  FROM credit_events GROUP BY "agencyId"
), reserved AS (
  SELECT l."agencyId",sum(x.amount) AS amount
  FROM dms.refund_reservation x JOIN dms.credit_lot l ON l.id=x."lotId"
  WHERE x.state='ACTIVE' GROUP BY l."agencyId"
), evidence AS (
  SELECT d."agencyId",sum(u.amount) AS amount
  FROM dms.upfront_confirmation u
  JOIN dms.document_revision r ON r.id=u."issueRevisionId"
  JOIN dms.document d ON d.id=r."documentId"
  WHERE u.state='VERIFIED' AND u."receiptDocumentId" IS NULL
    AND u."receivedAt">=(CAST(:fromDate AS date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    AND u."receivedAt"<(CAST(:toDate AS date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  GROUP BY d."agencyId"
), joined AS (
  SELECT a.id AS "agencyId",a.code AS "agencyCode",a.name AS "agencyName",
    coalesce(c.received,0) AS "cashReceived",coalesce(c.refunded,0) AS "cashRefunded",
    coalesce(e.amount,0) AS "verifiedUnreceiptedAmount",
    coalesce(h.opening,0) AS "openingCredit",coalesce(h.created,0) AS "creditCreated",
    coalesce(h.applied,0) AS "creditApplied",coalesce(h.refunded,0) AS "creditRefunded",
    coalesce(h.closing,0) AS "closingCredit",coalesce(x.amount,0) AS "currentReservedCredit",
    coalesce(h.current,0)-coalesce(x.amount,0) AS "currentAvailableCredit"
  FROM dms.agency a LEFT JOIN cash c ON c."agencyId"=a.id
  LEFT JOIN credit h ON h."agencyId"=a.id LEFT JOIN reserved x ON x."agencyId"=a.id
  LEFT JOIN evidence e ON e."agencyId"=a.id
  WHERE (CAST(:agencyId AS bigint) IS NULL OR a.id=:agencyId)
), filtered AS (
  SELECT * FROM joined WHERE "cashReceived"<>0 OR "cashRefunded"<>0
    OR "verifiedUnreceiptedAmount"<>0 OR "openingCredit"<>0 OR "creditCreated"<>0
    OR "creditApplied"<>0 OR "creditRefunded"<>0 OR "closingCredit"<>0
    OR "currentReservedCredit"<>0 OR "currentAvailableCredit"<>0
)
SELECT statement_timestamp() AS "__generatedAt",f.*
FROM (SELECT 1) moment LEFT JOIN filtered f ON true
"""

REPORT_SQL = {
    "sales": SALES,
    "debt": DEBT,
    "inventory": INVENTORY,
    "product-sales": PRODUCT_SALES,
    "cash-and-credit": CASH_AND_CREDIT,
}
