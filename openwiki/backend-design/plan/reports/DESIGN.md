# M30 Reports Design

Prepared: 2026-10-28. Updated: 2026-10-29. The eight-file implementation follows
the read-only specifications below, with the materialization refinement recorded
here. Offline, actual PostgreSQL semantics/snapshots, automated rendered-page checks
and publication pass. Historical inspection findings are retained for traceability.

## Implemented Refinements

- `queries.py` owns the five SELECTs. `ReportQueries.read` executes exactly one
  bound statement, consumes and closes its result, and returns detached scalars.
- The entire business-filtered population is materialized once. `ReportService.read`
  validates every row, computes integral totals with Python integer sums (not a
  default Decimal context), then sorts/pages JSON in memory. This is O(full-result)
  memory, not SQL limit+1. One statement still supplies one coherent snapshot;
  no hidden row cap or independent page queries exist.
- `exporting.py` implements negotiation, explicit-text XlsxWriter output, lossless
  XLSX chunks/numbered sheets and ReportLab/NotoSans PDF groups. All rendering is
  in-memory; buffers close on failure, and no spool or file cleanup callback exists.
- The router rolls back/releases the read transaction before binary rendering and
  returns completed bytes only. JSON sessions close through the shared dependency.
- Rendering regression exposed a ReportLab physical row split: the continuation text
  lost its ID on a new page. PDF chunks now have at most 120 characters/eight newlines
  and `splitInRow=0`, keeping every physical continuation and repeated ID together.
- RD01 canonical/runtime aggregate refs are aligned by existing shared WIP; actual
  historical PostgreSQL witness now passes; validation is not inferred from coverage.
- RD03 populations are the selected implementation policy: all products for inventory,
  and nonzero historical/period/current components for cash-credit. Grouping is by ID.
  Real population/current-label fixtures pass, including 101+ matched identities.
- RD06 uses the already locked XlsxWriter dependency. This worker changes no locks.

The historical decision table below explains the original choices; its OPEN/future
wording describes preparation, not the current source. VERIFICATION is authoritative
for completed gates. Reusable `ReportQueries.statement(kind)` remains transport/grant
independent; M31 must compose one outer statement and authorize each section itself.

## Inspected Source

Paths below are relative to the repository root.

| Source | Concrete finding and implication |
| --- | --- |
| backend/alembic/sql/0001_initial.sql:1406-1481 | current_document selects document.currentRevisionId without filtering status; reports must require POSTED. sales_report already counts headers, includes return-only agencies and computes company-window share before external filtering. debt_report already nets signed events and excludes zero-period-activity agencies. |
| backend/alembic/sql/0001_initial.sql:197-257 | document_line.lineAmount is stored coalesce(returnAmount,round(abs(quantity)*unitPrice,0)); use it for product sales. revision/line snapshots remain historical, not current prices. |
| backend/alembic/sql/0001_initial.sql:339-419,769-860 | Three append-only ledgers retain businessDate/businessOrder and exact opposite reversals; classify by source/kind, not sign alone. refund_reservation has ACTIVE/RELEASED/CONSUMED states. |
| backend/alembic/sql/0007_return_lot_successors.sql | Same-return current POSTED successors may create on original immutable lots. lot.sourceRevisionId/createdAt is not the date of every effective credit event. |
| backend/alembic/sql/0008_historical_receipt_corrections.sql and 0009_historical_issue_corrections.sql | Historical admission guards change; report function/view definitions are not replaced. No report DDL change is assumed. |
| backend/app/modules/inventory/repository.py:12-65 | statement computes full signed ledger balances before display filters, at atomic date/order checkpoints; historical balances are not current cache values. |
| backend/app/modules/receivables/repository.py:10-63,145-196 | overview demonstrates one-statement moment/base/page/totals and anchor validity; statement sums original/reversal entries before paging. |
| backend/app/modules/agency_credit/repository.py:63-113 | Credit history also sums signed entries, independent of original lot creation dates. |
| backend/app/modules/settlement_core/repository.py:74-104,156-170,204-275 | Return lots resolve effective current return revision for timeline ordering while preserving original provenance; available/current differs from historical checkpoint sums. Reports must not invoke writer/lock helpers. |
| backend/app/modules/document_core/batches.py:4-20 | reversal_values retains original effective identity/date/order and negates only value; createdAt is not report-effective time. |
| backend/app/common/{schemas,values,dates,pagination}.py | Aggregate aliases, exact fixed-point formatting, Vietnam UTC+07 dates, signed scoped cursors, safe sort registry and limit+1 page construction already exist. |
| backend/app/modules/auth/dependencies.py:31-49 | require_permissions supports live allOf checks, no role-name bypass. |
| backend/app/modules/document_history/printing.py | Existing ReportLab, NotoSans registration and escaping are reusable precedents. Its negotiate supports HTML/PDF with HTML default, so cannot be reused unchanged for report negotiation. |
| backend/pyproject.toml | ReportLab runtime and pypdf dev dependency exist; XlsxWriter/openpyxl are not declared. No installation is performed here. |

## Decision Register

| Decision | Planned disposition and remaining gate |
| --- | --- |
| M30-RD01 Historical inventory schema | OPEN contract gate. Canonical InventoryReportRow.openingStock/closingStock still reference Quantity (<10^15), whereas InventoryStatement already uses AggregateQuantity and D14 records a valid 1.2e15 historical witness with current 7e14. Propose widening only those two report fields to AggregateQuantity in the canonical contract and runtime models during authorized implementation. Reproduce/report-schema-test the witness first. No clamping, rejecting valid history, or silently widening only runtime. No contract edit now. |
| M30-RD02 Immutable query reuse | Select existing sales_report/debt_report where semantics match; compose outer filters/page/totals in one statement. Inventory/product/cash-credit are parameterized report-owned derived SQL. No duplicated DDL or new report tables/views required by default. |
| M30-RD03 Row populations and labels | Sales/debt populations follow their functions; product sales is union of qualifying issue/return product IDs even if amounts are zero. Inventory starts from all products including inactive/zero rows, with per-product unit, as no activity-only restriction exists in its operation. Cash-credit includes any agency with nonzero opening/closing credit, period cash/credit/evidence or current reserved/available amounts; omit wholly zero/no-activity agencies. These two unspecified population choices require explicit owning review/fixtures before publication, not a claim they are already contract text. Labels are current agency/product/unit names/codes; facts/prices/amounts remain immutable revision/ledger data. Group only by IDs, never names. |
| M30-RD04 Exactness | PostgreSQL unconstrained numeric sums; integer money and scaled quantities stay exact. Percentage uses div(2*gross*1000000+companyGross,2*companyGross)*0.0001, with an explicit zero-denominator case, to round nonnegative shares HALF_UP exactly once. Numeric division followed by round(numeric,4) can double-round at large-value boundaries. Preserve strings at JSON boundaries; use Python ints/scaled ints or operand-sized localcontext if arithmetic leaves SQL, never the default 28-digit context. XLSX policy: all exact ID/money/quantity/percentage values are explicit text, even small values, consistently labelled; counts may be numeric integers only while <=15 digits, otherwise explicit text. |
| M30-RD05 Snapshot and paging | One SQL statement per report execution produces period, full-filter totals and either limit+1 JSON rows or all export rows. A materialized moment supplies one generatedAt. READ COMMITTED auth may have already opened the request transaction; do not SET isolation mid-transaction. No report locks/commit or writer calls. |
| M30-RD06 Exports | One detached authorized dataset feeds both binary renderers, using stable ID-ascending order and ignoring all page controls. Reuse ReportLab/font; proposed XLSX implementation is XlsxWriter with formula/URL conversion disabled and write_string for exact/untrusted cells. Its addition remains a future dependency/locked-build decision, not an installed capability. No hand-built OOXML fallback assumed. |
| M30-RD07 Transport and resources | Default JSON; negotiate three source media with q and specificity. Validate business filters for every format. For exports ignore page controls semantically, including stale/foreign cursors, and do not apply page-sort/limit validation as an export restriction. No silent result cap. Fully materialize and close/release the request read transaction before render; renderer owns bytes/spool, not Session. Measure large exports; explicit resource-limit design needs contract/error review if later required. |

RD01 and the review gates in RD03/RD06 remain open; the rest are selected planning
directions awaiting implementation/test evidence. D14 is not closed for M30 merely
because common aggregate aliases or earlier statements have evidence.

## Request And Reuse Boundary

1. Existing live authentication plus report-specific require_permissions(all_of=...)
   runs before report data lookup or rendering, for every format.
2. negotiate_report_media chooses format. Parse strict shared BusinessDate/Id/
   CatalogParameter inputs, validate half-open range and allowed business filters.
   Only JSON parses page controls with the source enums/ranges and CursorCodec.
3. ReportService.read dispatches through a fixed five-report registry, never a
   user-provided SQL object/column name. ReportQueries executes one bound statement.
4. Validate the exact detached projection with canonical models; build JSON page
   or export dataset without additional SQL. A query/render failure produces the
   safe existing error envelope, not partial 200 or an empty successful report.
5. JSON returns source models. Binary path releases the read session transaction,
   then renders and returns the completed attachment with safe headers.

ReportQueries is transport- and reports.read-independent so M31 can compose its
authorized sections without calling report HTTP or accidentally demanding
reports.read. It is an internal trusted seam, not an unauthenticated public API;
each consumer must enforce its own source grants before invoking it. M31 needs
one coherent aggregate snapshot across sections, not five separate report calls
with five generatedAt values. Its composition and D09 decision belong to M31.

## Query Specifications

All examples use :fromDate <= event date < :toDate and numeric IDs for SQL binding.
JSON ID conversion occurs only at projection boundaries. SQL identifiers and sort
fragments come from fixed registries. Numeric/date/filter values are bound parameters.

### Sales

Use raw AS MATERIALIZED (SELECT * FROM dms.sales_report(:fromDate,:toDate)).
company AS SELECT coalesce(sum("salesAmount"),0) FROM raw is computed before any
agencyId/typeId filter. Filter raw by agency ID and current dms.agency.typeId;
the company denominator remains unchanged. Recompute salesRate from exact integer
gross/company values in the outer projection using RD04, rather than reusing the
source function's potentially double-rounded rate. Aggregate the entire filtered relation
for SalesTotals, attaching company's gross even if the filtered relation is empty.
Only then apply page boundary/order/limit+1. Source function groups POSTED current
headers by agency without joining lines, so one multi-line issue counts once.
An outer reimplementation must not push agency predicates below the company window.

### Debt

Use dms.debt_report(:fromDate,:toDate) as raw and join current agency only for
typeId/districtId filters. Its internal receivable events are grouped by agency,
businessDate,businessOrder,kind with sum(amount), including both originals/reversals.
Opening includes all earlier events; period fields separately sum CHARGE and
negated PAYMENT/RETURN/CREDIT. Function row admission is nonzero period components,
not merely a nonzero opening or closing. Aggregate every DebtAmounts column over
filtered rows, coalescing all totals to exact zero for no matches. Do not replace
cashApplied with full receipt totals: excess cash belongs to credit, not paid debt.

### Inventory

Build events by joining inventory_entry e -> posting_batch b -> document_revision r
-> document d, retaining e.productId,e.unitId,e.businessDate,e.businessOrder,d.kind
and signed e.quantity. Group by those effective dimensions before classification.
Do NOT restrict d.status=POSTED or b.revisionId=d.currentRevisionId in this ledger
query: canceled/superseded originals and their reversals must both remain to net.
Classification is source kind, not e.quantity>0: a reversed issue is not a receipt.

Per product/unit, opening=sum(quantity) with date<fromDate, receipt=sum(quantity)
for STOCK_RECEIPT in period, issue=-sum(quantity) for STOCK_ISSUE, return=sum(quantity)
for SALES_RETURN, adjustment=sum(quantity) for STOCK_ADJUSTMENT. Closing is sum of
all signed quantities before toDate and independently matches the stated equation.
Left join aggregates to dms.product/unit population (RD03), keeping stable unitId;
recorded-unit policy forbids reinterpreting historical quantity in a new unit.
No currentStock cache substituted for a historical close. No scalar grand totals.

### Product Sales

Read current_document c with status=POSTED, kind in STOCK_ISSUE/SALES_RETURN,
date in period and optional agency filter. Join document_line l on
l.revisionId=c.revisionId; optional product filter applies to l.productId.
Group by productId/unitId: issue quantities sum l.quantity as soldQuantity,
return quantities sum l.quantity as returnedQuantity; money sums stored l.lineAmount
in the respective kind, with net=gross-returns. A return's stored returnAmount may
be zero even when quantity is positive. Do not use ABS(net quantities), reround
each return quantity*price, sum header totals per line, or join stock/credit legs.
Join current product/unit names after aggregation; the stable recorded unit must
match. Totals contain only salesAmount/returnAmount/netSalesAmount, never a combined
quantity across units. No document count is invented for this response.

### Cash And Credit

Build independent per-agency CTEs before joining; never join raw receipt rows to
raw lots/entries/reservations/confirmations, which multiplies cash and liabilities.

| CTE | Exact source and computation |
| --- | --- |
| cash | current_document POSTED PAYMENT_RECEIPT and REFUND in period; sum totalAmount separately for full cashReceived/cashRefunded. Include AUTO_FROM_ISSUE, DEBT_COLLECTION, RECEIVED_UNAPPLIED, CASH/BANK_TRANSFER/ONLINE once each. |
| credit_events | credit_entry grouped by agencyId,businessDate,businessOrder,kind, summing all signed originals/reversals; no current revision/status filter and no lot source-date attribution. |
| period_credit | opening=sum(amount) before fromDate; created=sum(CREATED) in period; applied=-sum(OFFSET); refunded=-sum(REFUND); closing=sum(amount) before toDate. |
| current_credit | sum all signed credit_entry amounts without period cutoff by agency; reconciliation reference is agency_balance.currentCredit, not historical closingCredit. |
| reserved | refund_reservation ACTIVE joined to credit_lot only to resolve agencyId; sum amount. RELEASED/CONSUMED excluded. available=current_credit-reserved. Aggregate separately from entries to avoid fanout. |
| evidence | upfront_confirmation VERIFIED with receiptDocumentId IS NULL; join its issueRevisionId to document_revision/document only to resolve agencyId, not to require current issue revision. receivedAt >= Vietnam midnight(fromDate) and < Vietnam midnight(toDate). Do not use verifiedAt or raw timestamp::date under server timezone. |

Union the agency IDs qualifying under RD03, left join each single-row-per-agency
CTE, coalesce all absent components to zero, then apply agencyId business filter.
Sum every CashCreditAmounts field across this filtered population before paging.
Keep currentReserved/currentAvailable visually separate from period-credit columns.
PENDING/UNKNOWN refund attempts retain reservations but are not cashRefunded until
a POSTED refund exists. FAILED/EXPIRED online payments add no cash. SUCCESS payment
and payment_event are evidence behind a receipt, not independent cash sources.
An upfront separation changes evidence into a full receipt; never count both in
one snapshot. Return lot date moves follow credit_entry.businessDate even though
the original credit_lot.sourceRevisionId remains unchanged.

## Original-Period And Snapshot Rules

Corrections are retrospective current-effective reports. Append-only opposite
ledger legs retain original businessDate/order; replacements use their valid new
businessDate with stable document order. Net old legs at their old checkpoint;
new replacement facts affect their replacement period. Never bucket reversal by
createdAt, classify it as a new opposite business kind, or erase old rows. Genuine
returns use their own businessDate, not the source issue month. Cash uses current
receipt/refund businessDate, not payment-event time.

Use a single statement with moment/base/filtered/totals/page-or-all CTEs, including
an anchor-validity projection and zero-result metadata. Reuse scoped CursorCodec
and build_page. Scope includes operation, period, all business filters and sort;
numeric sort appends stable agencyId/productId in the same direction. Reject
tampered/cross-report/filter-changed cursors and anchors removed or whose sort
value changed. Totals and company gross never use the cursor predicate. Separate
HTTP requests may change after corrections; clients restart when anchor invalidates.
No persisted cursor snapshot or historical time-travel promise is introduced.

If implementation cannot produce one-statement export materialization, redesign
explicitly around a dedicated read-only REPEATABLE READ transaction established
before any SELECT and reauthorize within that boundary. Do not change isolation
inside the already-authenticated request transaction or independently page reads
under READ COMMITTED. Such a deviation needs fresh concurrency evidence.

## Export Contract

The detached dataset carries report key/title, period/generatedAt, explicit
business-filter descriptions, columns/units, exact rows and supported full-filter
totals/company denominator. It contains no Session, live ORM lazy loader, contact
details, provider payload, token or arbitrary user-controlled path.

Binary requests ignore cursor/limit/sort page, including an old opaque cursor;
business filters and date validity still apply. Export order is agencyId ascending
or productId ascending. JSON default product-sales order remains -salesAmount.
Missing Accept/*/* selects JSON; exact q=0 overrides broader wildcards; rank by
effective quality/specificity, breaking equivalent supported choices JSON, XLSX,
PDF. Malformed quality values or no acceptable supported media produce 406.

XLSX uses explicit text for exact numeric fields and untrusted identities;
never pass strings beginning =,+,-,@, tab, CR, LF, spaces or Unicode variants to
formula/autodetection methods. Disable URL conversion and write no formulas,
macros, external links or automatic hyperlinks. Negative legitimate money remains
exact text, not a spreadsheet formula. Static server-owned sheet names/filenames
avoid formula/path/control-character injection. Excel cell text and row limits
must not silently truncate: preserve long text in labelled continuation cells/rows
with stable record ID and explicit field/chunk numbering; split rows into numbered
sheets with repeated headers when necessary. Review that physical-row mapping and
test reconstruction before claiming arbitrary TEXT support. No added input-length
business restriction to evade existing unbounded TEXT columns.

PDF uses ReportLab plus bundled NotoSans (existing OFL), escaped Paragraph content,
landscape A4 where needed, report-specific column groups for wide cash/debt tables,
repeated headers and ID on continuation rows/sections, wrapped text, footers and
clear historical/current labels. Keep every exact digit legible, splitting large
tokens or using continuation detail blocks rather than ellipsis/clipping. Do not
reuse document-print headings/status/contact fields as a report schema. Test actual
extracted Vietnamese text plus rendered layout; font registration alone is not proof.

Render fully before returning a response. Prefer BytesIO for the initial measured
scope; any SpooledTemporaryFile stays under existing configured writable data/TMPDIR
with bounded memory threshold and guaranteed cleanup on render failure, response
completion and client disconnect. Never hold DB locks/connections through PDF/XLSX
generation or stream a still-being-built workbook. Record row/byte counts, query/
render duration and cleanup without logging cell values/credentials. No new service,
export persistence or unreviewed silent cap is part of the design.
