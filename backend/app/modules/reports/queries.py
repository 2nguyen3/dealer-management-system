"""Fixed SQL projections over POSTED documents (handoff 3.4). All values are bound.

Drafts and cancelled documents never count: every aggregate filters ``status='POSTED'``.
Periods are half-open business-date intervals ``[fromDate, toDate)``. Each statement
returns one sentinel row with a null identity when it has no data, so the generation
instant is always read from the same snapshot.
"""

SALES = """
WITH issues AS MATERIALIZED (
  SELECT d."agencyId", count(*) AS "numberOfIssues", sum(d."totalAmount") AS "salesAmount"
  FROM dms.document d
  WHERE d.kind='STOCK_ISSUE' AND d.status='POSTED'
    AND d."businessDate">=CAST(:fromDate AS date) AND d."businessDate"<CAST(:toDate AS date)
  GROUP BY d."agencyId"
), company AS (
  SELECT coalesce(sum("salesAmount"),0) AS gross FROM issues
), filtered AS (
  SELECT i.*, a.code AS "agencyCode", a.name AS "agencyName"
  FROM issues i JOIN dms.agency a ON a.id=i."agencyId"
  WHERE (CAST(:agencyId AS bigint) IS NULL OR a.id=:agencyId)
    AND (CAST(:typeId AS integer) IS NULL OR a."typeId"=:typeId)
)
SELECT statement_timestamp() AS "__generatedAt", company.gross AS "__companySalesAmount",
  f."agencyId", f."agencyCode", f."agencyName", f."numberOfIssues", f."salesAmount",
  -- Round the scaled integer ratio once (half up, 4 decimals), avoiding double rounding.
  CASE WHEN company.gross=0 THEN 0 ELSE
    div(2*f."salesAmount"*1000000+company.gross,2*company.gross)*0.0001
  END AS "salesRate"
FROM company LEFT JOIN filtered f ON true
"""

DEBT = """
WITH moves AS (
  SELECT d."agencyId",
    coalesce(sum(d."totalAmount") FILTER (WHERE d.kind='STOCK_ISSUE'
      AND d."businessDate"<CAST(:fromDate AS date)),0)
    - coalesce(sum(d."totalAmount") FILTER (WHERE d.kind='PAYMENT_RECEIPT'
      AND d."businessDate"<CAST(:fromDate AS date)),0) AS "openingDebt",
    coalesce(sum(d."totalAmount") FILTER (WHERE d.kind='STOCK_ISSUE'
      AND d."businessDate">=CAST(:fromDate AS date)),0) AS "debtIncrease",
    coalesce(sum(d."totalAmount") FILTER (WHERE d.kind='PAYMENT_RECEIPT'
      AND d."businessDate">=CAST(:fromDate AS date)),0) AS "paidAmount",
    count(*) FILTER (WHERE d."businessDate">=CAST(:fromDate AS date)) AS movements
  FROM dms.document d
  WHERE d.status='POSTED' AND d.kind IN ('STOCK_ISSUE','PAYMENT_RECEIPT')
    AND d."businessDate"<CAST(:toDate AS date)
  GROUP BY d."agencyId"
), filtered AS (
  SELECT m."agencyId", a.code AS "agencyCode", a.name AS "agencyName", m."openingDebt",
    m."debtIncrease", m."paidAmount",
    m."openingDebt"+m."debtIncrease"-m."paidAmount" AS "closingDebt"
  FROM moves m JOIN dms.agency a ON a.id=m."agencyId"
  WHERE (m."openingDebt"<>0 OR m.movements>0)
    AND (CAST(:agencyId AS bigint) IS NULL OR a.id=:agencyId)
    AND (CAST(:typeId AS integer) IS NULL OR a."typeId"=:typeId)
    AND (CAST(:wardId AS integer) IS NULL OR a."wardId"=:wardId)
)
SELECT statement_timestamp() AS "__generatedAt", f.*
FROM (SELECT 1) moment LEFT JOIN filtered f ON true
"""

INVENTORY = """
WITH moves AS (
  SELECT l."productId",
    coalesce(sum(CASE WHEN d.kind='STOCK_RECEIPT' THEN l.quantity ELSE -l.quantity END)
      FILTER (WHERE d."businessDate"<CAST(:fromDate AS date)),0) AS "openingStock",
    coalesce(sum(l.quantity) FILTER (WHERE d.kind='STOCK_RECEIPT'
      AND d."businessDate">=CAST(:fromDate AS date)),0) AS "receiptQuantity",
    coalesce(sum(l.quantity) FILTER (WHERE d.kind='STOCK_ISSUE'
      AND d."businessDate">=CAST(:fromDate AS date)),0) AS "issueQuantity"
  FROM dms.document d JOIN dms.document_line l ON l."documentId"=d.id
  WHERE d.status='POSTED' AND d.kind IN ('STOCK_RECEIPT','STOCK_ISSUE')
    AND d."businessDate"<CAST(:toDate AS date)
  GROUP BY l."productId"
), filtered AS (
  SELECT p.id AS "productId", p.code AS "productCode", p.name AS "productName",
    p."unitId", u.name AS "unitName",
    coalesce(m."openingStock",0) AS "openingStock",
    coalesce(m."receiptQuantity",0) AS "receiptQuantity",
    coalesce(m."issueQuantity",0) AS "issueQuantity",
    coalesce(m."openingStock",0)+coalesce(m."receiptQuantity",0)
      -coalesce(m."issueQuantity",0) AS "closingStock"
  FROM dms.product p JOIN dms.unit u ON u.id=p."unitId"
  LEFT JOIN moves m ON m."productId"=p.id
  WHERE (CAST(:productId AS bigint) IS NULL OR p.id=:productId)
)
SELECT statement_timestamp() AS "__generatedAt", f.*
FROM (SELECT 1) moment LEFT JOIN filtered f ON true
"""

PRODUCT_SALES = """
WITH amounts AS (
  SELECT l."productId", count(DISTINCT d.id) AS "numberOfIssues",
    sum(l.quantity) AS "soldQuantity", sum(l."lineAmount") AS "salesAmount"
  FROM dms.document d JOIN dms.document_line l ON l."documentId"=d.id
  WHERE d.kind='STOCK_ISSUE' AND d.status='POSTED'
    AND d."businessDate">=CAST(:fromDate AS date) AND d."businessDate"<CAST(:toDate AS date)
    AND (CAST(:agencyId AS bigint) IS NULL OR d."agencyId"=:agencyId)
    AND (CAST(:productId AS bigint) IS NULL OR l."productId"=:productId)
  GROUP BY l."productId"
), filtered AS (
  SELECT a."productId", p.code AS "productCode", p.name AS "productName", p."unitId",
    u.name AS "unitName", a."numberOfIssues", a."soldQuantity", a."salesAmount"
  FROM amounts a JOIN dms.product p ON p.id=a."productId" JOIN dms.unit u ON u.id=p."unitId"
)
SELECT statement_timestamp() AS "__generatedAt", f.*
FROM (SELECT 1) moment LEFT JOIN filtered f ON true
"""

COLLECTIONS = """
WITH filtered AS (
  SELECT d."businessDate", count(*) AS "receiptCount",
    coalesce(sum(d."totalAmount") FILTER (WHERE d."receiptType"='CASH'),0) AS "cashAmount",
    coalesce(sum(d."totalAmount") FILTER (WHERE d."receiptType"='BANK_TRANSFER'),0)
      AS "bankTransferAmount",
    coalesce(sum(d."totalAmount") FILTER (WHERE d."receiptType"='ONLINE'),0) AS "onlineAmount",
    sum(d."totalAmount") AS "totalAmount"
  FROM dms.document d
  WHERE d.kind='PAYMENT_RECEIPT' AND d.status='POSTED'
    AND d."businessDate">=CAST(:fromDate AS date) AND d."businessDate"<CAST(:toDate AS date)
    AND (CAST(:agencyId AS bigint) IS NULL OR d."agencyId"=:agencyId)
    AND (CAST(:receiptType AS text) IS NULL OR d."receiptType"=:receiptType)
  GROUP BY d."businessDate"
)
SELECT statement_timestamp() AS "__generatedAt", f.*
FROM (SELECT 1) moment LEFT JOIN filtered f ON true
"""

REPORT_SQL = {
    "sales": SALES,
    "debt": DEBT,
    "inventory": INVENTORY,
    "product-sales": PRODUCT_SALES,
    "collections": COLLECTIONS,
}
# Identity column of each report row; the null-identity sentinel row is dropped.
IDENTITIES = {
    "sales": "agencyId",
    "debt": "agencyId",
    "inventory": "productId",
    "product-sales": "productId",
    "collections": "businessDate",
}
