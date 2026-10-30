# M30 Reports Requirements

Prepared: 2026-10-28. Updated: 2026-10-29. These are the implemented acceptance
requirements, not blanket pass claims. See VERIFICATION for offline, PG and publication status.

Completion2026-10-29: all five operations/fifteen format paths are published after
independent ledger/M29 replay,101+exports,snapshot,read-only and resource/layout gates.
Reports191offline cases pass within the1083case full offline run;11unique owningPG
nodes pass across documented resumes. Evidence and explicit automated-not-human PDF
inspection scope are in [VERIFICATION](VERIFICATION.md). Whole R6 remains open.
Source: [canonical Reports contract](../../API/openapi.json), BM6.1/BM6.2/QD6
in [BA](../../../BA/DMS_exploration.md), selected immutable-ledger rules and
[D14](../full_backend/DECISIONS.md). Current contract/DDL takes precedence over
older BA descriptions such as treating all debt decreases as new cash.

## Operation Matrix

Every operation requires fromDate and toDate, real ISO calendar dates with
fromDate < toDate. The interval is [fromDate,toDate), not an inclusive end date.
Monthly requests use first-of-month and first-of-next-month; valid non-monthly
ranges remain allowed. No undocumented date-span/business text-length limit.

| ID | Operation | Optional business filters | JSON sort enum; default |
| --- | --- | --- | --- |
| R01 | getSalesReport | agencyId, typeId | agencyId, -agencyId, salesAmount, -salesAmount, netSalesAmount, -netSalesAmount; agencyId |
| R02 | getDebtReport | agencyId, typeId, districtId | agencyId, -agencyId, closingDebt, -closingDebt; agencyId |
| R03 | getInventoryReport | productId | productId, -productId, closingStock, -closingStock; productId |
| R04 | getProductSalesReport | productId, agencyId | productId, -productId, salesAmount, -salesAmount, soldQuantity, -soldQuantity; -salesAmount |
| R05 | getCashAndCreditReport | agencyId | agencyId, -agencyId, cashReceived, -cashReceived, closingCredit, -closingCredit; agencyId |

JSON alone uses cursor/limit/sort paging. Limit defaults to 25, range 1..100.
ID filters use canonical BIGINT decimal strings, at most 9223372036854775807;
typeId/districtId are integer CatalogId query parameters, at most 2147483647.
Filter IDs with no matching collection rows return an empty report, not a new
detail-resource 404 contract. typeId/districtId filter current agency attributes,
not historical revision snapshots. Never implicitly exclude TERMINATED agencies
or INACTIVE products/units whose history is relevant.

## Business Invariants

| Requirement | Required behavior |
| --- | --- |
| R06 Sales | Count current POSTED STOCK_ISSUE headers once, never count lines, allocations or revisions as issues. Sum stored header totalAmount as gross; returns use current POSTED SALES_RETURN business dates. Include return-only agencies and allow negative net. |
| R07 Share | salesRate = round(agency gross * 100 / company gross,4); company gross uses all agencies in the same period before agencyId/typeId/page filters. Zero company gross gives zero rate. Do not calculate rates from net or filtered totals. |
| R08 Debt | openingDebt sums signed receivable entries before fromDate; CHARGE increases, PAYMENT/RETURN/CREDIT decrease by separately negated sums. debtDecrease=cashApplied+returnsApplied+creditApplied; closingDebt=openingDebt+debtIncrease-debtDecrease. Include only agencies with nonzero net period components, matching debt_report; exclude opening-only debt. |
| R09 Inventory | openingStock sums ledger quantities before fromDate; receiptQuantity is receipt-source sum, issueQuantity is negated issue-source sum, returnQuantity is return-source sum, adjustmentQuantity is signed adjustment-source sum. closingStock=openingStock+receiptQuantity-issueQuantity+returnQuantity+adjustmentQuantity. No aggregate quantity across unlike units. |
| R10 Product sales | Current POSTED issue/return lines contribute soldQuantity/returnedQuantity and stored lineAmount. Zero-VND returns still contribute quantity; never recompute cumulative return rounding as quantity*price or use current product prices. Return-only products remain visible. |
| R11 Real cash | cashReceived sums full current POSTED PAYMENT_RECEIPT totals once, all receipt types/methods. cashRefunded sums current POSTED REFUND totals once. CREDIT_APPLICATION is not new cash; SALES_RETURN is not cash payout. Do not add provider payments/events or issue immediatePayment again. |
| R12 Evidence | verifiedUnreceiptedAmount sums upfront_confirmation.amount with state VERIFIED and receiptDocumentId NULL, receivedAt within Vietnam-local period boundaries. It is separate from receipted cash, not debt reduction or credit creation. |
| R13 Credit | openingCredit and closingCredit are historical signed credit-entry sums. CREATED adds creditCreated, OFFSET contributes creditApplied as negated sum, REFUND contributes creditRefunded as negated sum. openingCredit+creditCreated-creditApplied-creditRefunded=closingCredit. |
| R14 Current credit | currentReservedCredit uses ACTIVE reservations only; currentAvailableCredit equals current total credit less those reservations at generatedAt's snapshot, not closingCredit less current reservations. Current-only/opening-only cash-credit rows follow DESIGN RD03. |
| R15 Corrections | Net originals/reversals at ledger businessDate/businessOrder, not createdAt/postedAt/correction date. Date moves remove old-period effects and add replacement-period effects. Report current effective history, not an as-known-at historical audit snapshot. Preserve original lots and receipt provenance. |

## Representation And Security

- R16: ReportPeriod includes fromDate, toDate and one aware generatedAt. All rows,
  totals, company denominator and current-credit/evidence fields in one response
  share one SQL snapshot. Independent HTTP pages do not promise a frozen snapshot.
- R17: Sales totals include numberOfIssues, salesAmount, returnAmount, netSalesAmount
  and companyGrossSales. Debt/CashCredit totals contain every corresponding amount
  field. Product-sales totals contain only its three money fields. Inventory has
  no totals object; do not invent a cross-unit grand total in any format.
- R18: Money/quantity/percentage and BIGINT IDs serialize as exact plain decimal
  strings using aggregate aliases as specified. No float, scientific notation,
  storage-domain cast, silent clamping or default Decimal-context rounding. Preserve
  CatalogId/count JSON integer types. Canonical/runtime inventory opening/closing
  now use AggregateQuantity; the real historical witness remains separately tested.
- R19: Every JSON/XLSX/PDF request requires reports.read AND sales.read, debt.read or
  inventory.read per PLAN's operation table. Missing/false grant denies access;
  MANAGEMENT has no bypass. Fresh grants apply on the next request. No new
  agency.read/product.manage/post/provider grants are required for report identities.
- R20: Accept supports application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  and application/pdf. Missing Accept or */* defaults to JSON. Respect q/specificity,
  reject unsupported or entirely excluded media with 406; no HTML/CSV fallback.
- R21: XLSX/PDF includes ALL rows matching business filters, full-filter totals and
  the unchanged company denominator, ignoring cursor/limit/page sort. Use canonical
  ID-ascending export order. No 100-row cap, top-10 cap or cursor decode in export.
- R22: Exact strings in spreadsheets are explicit text, not formulas or hyperlinks;
  disable automatic formula/URL interpretation. Include formula-prefix, whitespace/
  control-prefix, Unicode and >15-digit numeric cases. Financial totals are server
  values, never executable workbook formulas.
- R23: PDF renders Vietnamese glyphs from bundled NotoSans with escaped Paragraph
  text, repeated table headings, wrapping, page numbers and unclipped long/large
  values. No arbitrary network fetch, embedded user URL or document-print contact
  disclosure. JSON/XLSX/PDF disclose only canonical report identities and fields.
- R24: Binary output has correct Content-Type and safe attachment filename plus
  UTF-8 filename*, Vary: Accept, Cache-Control: no-store and nosniff. Finish render
  before sending 200/body; release DB resources before rendering; clean temporary
  resources on errors/disconnects. Empty reports still produce valid exports.
- R25: Use existing safe error/request-ID plumbing: source-declared 400,401,403,406,
  422,429,500 behavior. Invalid cursor is 400 INVALID_CURSOR; invalid intervals,
  filters/sorts are 422. No SQL, credentials, stack traces or filesystem paths leak.

## Scope Exclusions

No report writes or idempotency/If-Match requirements, historical master rewriting,
provider reconciliation, financial replay from reads, frontend implementation,
dashboard admission change or chatbot continuation change. No new report database,
runtime service or asynchronous job store. XlsxWriter is the existing locked export
dependency; no dependency or lock changes were made by this completion worker.
