# M31 Dashboard Requirements

Status2026-10-29: verified/published. All owning behavior gates pass:291offline cases,
14unique owningPG,3deployed dashboard cases and exact161/24module coverage. Current
aggregator68/0 is separately exact100%; commands/artifacts in VERIFICATION. Source
anchors refer to unchanged canonical files/D09. Whole R6/browser is not inferred.

## Source Register

| Evidence | Meaning |
| --- | --- |
| `../../API/openapi.json:477-478` | `getDashboard`, exact six-grant anyOf, required Month reference, JSON response and 400/401/403/422/429/500. |
| `../../API/openapi.json:531` | Required query `month`, pattern `^[0-9]{4}-(0[1-9]|1[0-2])$`; no default. |
| `../../API/openapi.json:729-746` | Exact response properties, section readers, nested required fields and chart/top-list limits. |
| `../../API/openapi.json:698-701,714-715,721` | Aggregate numeric strings and inherited report identities/product rows. |
| `../../API/openapi.json:475` | Cash report defines VERIFIED unreceipted by receipt time in the period, separate from cashReceived. |
| [D09](../full_backend/DECISIONS.md#d09--dashboard-admission-versus-section-projection) | Selected source-alignment interpretation preserves canonical six-grant admission and independent section projection; union admission is not selected. |
| `../full_backend/MODULES.md:693-710` | M30 prerequisite, per-section queries, explicit trend window/zero buckets/ties and coherent asOf. |
| `../full_backend/DESIGN.md:160-164,416-419` | One snapshot, fresh authorization, no accidental reports.read dependency. |
| `../../../database-design/business_decision_making.md:225-254,436-462` | Corrections restate original business period; real returns/refunds belong to their actual periods. |

## Authorization Matrix

Let A be the exact canonical six-grant admission set in [PLAN](PLAN.md). Return 403
if current allowed grants do not intersect A. For an admitted caller, independently
apply the following projection; grants not listed confer no section access.
This is the selected D09 interpretation, not a provisional security-policy change
awaiting approval. Section eligibility never substitutes for admission.

| Key | Required section grant (OR within a cell) | Single-grant route outcome |
| --- | --- | --- |
| `agencies` | `agency.read` | 200; only agencies plus month/asOf. |
| `inventory` | `inventory.read` | 200; only inventory plus month/asOf. |
| `sales` | `sales.read` | 200; only sales plus month/asOf. |
| `receivables` | `debt.read` | 200; only receivables plus month/asOf. |
| `pendingIssueCount` | `stock.issue.post`, `stock.issue.prepare` | post-only 200; prepare-only 403 under current admission. |
| `verifiedUnreceiptedAmount` | `cash.upfront.verify`, `cash.receipt.post` | verify-only 200; receipt-post-only 403 under current admission. |

Unauthorized keys must be absent, not null, zero, empty arrays or redacted stubs.
Do not query their data. `reports.read` alone, other unrelated grants alone, a
group name alone, false/missing grants and no grants cannot admit a request.
Example: agency.read + cash.receipt.post returns agencies and the money scalar,
but not receivables; debt.read without either cash grant must omit the scalar.
No extra agency.read/product.manage requirement for the minimal identities nested
in an already authorized debt/sales section. Never return contacts or provider evidence.

## Exact JSON Shape

Only `month` and `asOf` are required at root. The six section keys are optional,
non-null if present; all their declared child fields are mandatory when present.
Do not add `items`, `pagination`, period boundaries, export metadata, reservations,
available-credit fields or extra user/master/profile details to this operation.

| Object | Exact declared properties and types |
| --- | --- |
| Root | month: YYYY-MM string; asOf: aware date-time string; six permission-projected keys above. |
| agencies | total, active: integers >=0. |
| inventory | productCount, lowStockProductCount: integers >=0; receivedAmount: AggregateMoney. |
| sales | gross, returns: AggregateMoney; net: SignedAggregateMoney; monthlyTrend: MonthlySalesPoint array maxItems=12; topProducts: ProductSalesReportRow array maxItems=10. |
| receivables | currentDebt, currentCredit, cashReceived, cashRefunded: AggregateMoney; topAgencies: AgencyDebtPoint array maxItems=10. |
| pendingIssueCount | Integer >=0. |
| verifiedUnreceiptedAmount | AggregateMoney. |
| MonthlySalesPoint | month: YYYY-MM; gross, returns: AggregateMoney; net: SignedAggregateMoney. |
| AgencyDebtPoint | agencyId: Id; agencyCode, agencyName: strings; currentDebt: Money, not AggregateMoney. |
| ProductSalesReportRow | productId: Id; productCode, productName: strings; unitId: CatalogId integer; unitName: string; soldQuantity, returnedQuantity: AggregateQuantity; salesAmount, returnAmount: AggregateMoney; netSalesAmount: SignedAggregateMoney. |

`Id` is a positive BIGINT decimal string <=9223372036854775807; `CatalogId` is an
integer 1..2147483647. Money is a nonnegative integer string <10^18. AggregateMoney
is an unbounded nonnegative integer string; SignedAggregateMoney permits negative
integers. AggregateQuantity is a nonnegative decimal string with up to three decimal
places and no per-line magnitude bound. No float conversion, separators, exponent
notation, NaN/Infinity or clipping to storage bounds. Normalize negative zero.

## Metric Requirements And Planning Choices

The contract fixes field names/permissions/types/bounds, but not all ranking,
population or queue/window details. The following explicit child-plan conventions
must be verified against M30 before implementation; they are not quoted source rules.

| Requirement | Meaning |
| --- | --- |
| DB31-01 | month means Vietnam calendar month; all flows use half-open first-day to next-first-day business dates, not operation timestamps. |
| DB31-02 | agencies.total includes current ACTIVE and TERMINATED agencies; active counts ACTIVE only. Product counts include ACTIVE and INACTIVE current products; no hidden active-only filter. |
| DB31-03 | Low stock is currentStock < lowStockThreshold, strictly, including inactive products; no summed mixed-unit quantity. |
| DB31-04 | inventory.receivedAmount sums effective POSTED STOCK_RECEIPT current revision totals in the month, not current stock valuation or sales returns/adjustments. |
| DB31-05 | sales gross = POSTED issue totals; returns = POSTED return totals in their own month; net = gross - returns and can be negative. Corrected/canceled sources restate original periods. |
| DB31-06 | currentDebt/currentCredit are full current balances at the snapshot, including terminated agencies; do not net credit against debt or substitute month-end closing values. Reservations do not reduce total currentCredit. |
| DB31-07 | cashReceived sums full effective POSTED PAYMENT_RECEIPT totals of every receipt type/method in the month; cashRefunded sums effective POSTED REFUND totals in the month. Allocation totals, returns and credit applications are not new cash. |
| DB31-08 | pendingIssueCount counts current STOCK_ISSUE documents in PENDING with their READY current revision once, across business dates, not DRAFT/POSTED/CANCELLED or historical revisions. |
| DB31-09 | verifiedUnreceiptedAmount sums amount where state=VERIFIED and receiptDocumentId IS NULL, with receivedAt in the requested Vietnam month. It is a period-scoped current outstanding-evidence measure, not all-time cash or a month-end reconstruction. |
| DB31-10 | Trend ends at requested month and spans preceding eleven months; zero buckets explicit, ascending month. Top products use requested-month salesAmount DESC then numeric productId ASC; top agencies use currentDebt DESC then numeric agencyId ASC. |
| DB31-11 | One authorization/projection snapshot and one asOf for the response; never a mix of independently committed reads or cached cross-user sections. |

Top-product candidates have an issue or return line in the month, including
return-only/zero-amount activity; aggregate before limit. Top-agency candidates have
positive currentDebt; no zero-debt padding. Return fewer than ten if insufficient.
Monthly chart ordinary-year behavior is exactly twelve points; lower calendar-domain
boundaries and year-zero handling require the boundary gate in [TESTS](TESTS.md),
not an invented minimum-year restriction or invalid month labels.

## Completion Dependencies

D09's admission/projection ambiguity is resolved at the documentation/interpretation
level; canonical grant sets remain unchanged. Implementing those existing semantics
is not blocked by lack of approval for a security-changing alternative. M29/M30 full
reconciliation and all M31 implementation, runtime, coverage, concurrency and
publication/deployment gates remain open. No new permissions, schema repair or
report-service interface is assumed already implemented.
