# M31 Dashboard Design

Status2026-10-29: implemented/published; actual symbols and evidence in TESTS/VERIFICATION.
The original design below remains the acceptance specification, not proof on its own.
Dashboard shares M30's pure ProductSalesReportRow schema, not its transport/grants;
it owns bounded metric queries inside one authenticated read-only snapshot. The HTTP
dependency binds shared check_business_limit after fresh admission, before metrics.
Internal projection tests have no HTTP limiter; authentication/grant reload are never
optional. Serializer omits forbidden fields. No settings/migration/dependency/cache
or extra service was added. Whole R6/frontend/browser gates remain separate.

## Feature Boundary

Use `app/modules/dashboard/{router,schemas,service,repository,dependencies}.py`
only as needed at implementation time. No ORM table/model or migration is expected.
The router delegates to a proposed DashboardService; a proposed DashboardRepository
owns parameterized read queries. Repositories never commit or roll back. The service
owns read transaction lifecycle; no domain DML, audit write or durable command entry.

Reuse existing exact values/date/error/auth infrastructure and the M30 pure query
projections once their actual interface is known. Do not call `/reports/*`, inherit
their reports.read requirement, page through public endpoints, pass no-op authorization
callbacks into write services or invoke any posting/replay service from a dashboard read.
Keep report transport/export authorization separate from reusable projection logic.

D09 selects exact existing six-grant admission followed by independent existing
section-reader rules. Prepare-only/receipt-post-only callers receive 403; admitted
callers with either section grant can receive that section in a 200 response.
This conservative source alignment under the implementation request neither expands
nor removes permissions and is not user approval of a changed security policy.

## Snapshot And Authorization Protocol

Choose a dedicated synchronous read session from the existing application engine,
with REPEATABLE READ and READ ONLY configured before its first SQL statement. This
is a transaction within the existing Supabase database, not a new database/server.
The normal request auth dependency may already have opened a READ COMMITTED
transaction; never change its isolation in place or commit it just to change isolation.

1. Existing bearer processing validates the request normally. Start the dedicated
   read transaction using established session/connection lifetime conventions.
2. Make the first snapshot-bearing SELECT capture one database `clock_timestamp()`
   as `asOf`; this establishes the repeatable-read observation before other reads.
   It labels that observation, not a historical-query parameter or a guarantee
   about commits after snapshot acquisition. Never recapture it per section.
3. Reauthenticate principal claims/session/version and load current user/group grants
   inside that transaction, using the existing auth service with the dedicated session.
   Do not copy a stale allowedFunctions set from the earlier request session.
4. Apply exact canonical admission, then freeze an immutable per-request section set
   from the same grants. Reject before any domain query if admission fails.
5. Execute only authorized section queries on this same connection/transaction. Read
   current caches, documents/lines, evidence and reused M30 projections without locks
   or independent sessions. No collaborator may commit/end the snapshot mid-response.
6. Validate/materialize exact output while the snapshot is alive. Omit every forbidden
   key using explicit projected serialization; a model default of None must not leak
   through FastAPI response-model serialization. End the read transaction and close
   the dedicated session on success and on every exception.

Permission revocation committed before snapshot acquisition applies immediately.
A concurrent revocation after acquisition is observed on the next request; this
read-only design does not claim linearizability beyond its snapshot. Session/group
invalidations must still be rechecked in the dedicated transaction. No cross-request
response cache, shared mutable model or section cache is planned. Preserve existing
safe request IDs/errors; use existing private/no-store policy rather than cacheable
shared responses. Exhaustion/error paths release the connection.

Alternative single-statement CTE composition is acceptable only if authorization,
moment and every allowed metric actually share that statement's snapshot and forbidden
sections are not queried. It must not be used as an excuse for READ COMMITTED
multi-statement composition. The dedicated transaction is the selected baseline.

## Source Projections

| Section / measure | Read source and consistency rule |
| --- | --- |
| agencies | dms.agency counts, no contact/profile materialization. |
| inventory counts | dms.product + dms.inventory_balance; strict threshold comparator matches existing products repository and inventory_overview. |
| receivedAmount | dms.document + its current document_revision, kind STOCK_RECEIPT/status POSTED/state POSTED, month businessDate and totalAmount. |
| sales totals/trend | M30 issue/return projection, equivalent to sales_report/current_document effective revision semantics; corrections are not fresh sales. |
| topProducts | Current POSTED issue/return revision lines grouped by productId; sum stored lineAmount for sale, stored returnAmount for return; do not recompute rounded return amounts from quantity times price. |
| current debt/credit and topAgencies | dms.agency_balance + minimal dms.agency identity, same snapshot. Cross-check independent receivable/credit ledgers. |
| cash flows | Current effective POSTED PAYMENT_RECEIPT/REFUND revision totalAmount by businessDate; full cash once per document, not FIFO allocation join multiplicity. |
| pending queue | Current STOCK_ISSUE/PENDING with current READY revision; count stable document identities once, no monthly filter. |
| verified unreceipted | dms.upfront_confirmation state VERIFIED, null receiptDocumentId and receivedAt instant interval; no currentRevisionId-only join that can discard preserved older-revision money evidence. |

ProductReportIdentity uses current minimal product/unit identity, consistent with
M30 report projections; monetary/quantity facts come from immutable effective lines.
Units cannot change after recorded use. AgencyReportIdentity is current minimal
id/code/name. Renames must not join historical revisions twice or rewrite facts.
Deleted/unreferenced masters do not contribute activity; inactive/terminated masters
with history remain visible in their authorized aggregate populations.

Preaggregate each fact source before joins. Never sum header totals across a line
join, multiply receipts by allocation count, or subtract reservations from debt.
Use numeric/Decimal throughout and serialize using canonical Aggregate types.
Top-agency single balances retain Money bounds; company sums do not.

## Month, Charts And Rankings

`month` is required, exact lexical YYYY-MM, no trimming or implicit current-month
default. Parse calendar semantics explicitly. Use the existing fixed Vietnam +07
helper, not an optional timezone package. Business-date flows use date bounds;
receivedAt uses equivalent aware instants, e.g. October 2026 starts
2026-09-30T17:00:00Z and ends 2026-10-31T17:00:00Z. `asOf` is aware UTC output.

Trend uses M-11 through M inclusive, ascending and zero-filled, independent of server
today and selected month's current/previous/future status. Each bucket follows the
same gross/return/net projection as the headline; last bucket equals headline sales.
Future months are not clipped to now, though only committed data visible in the
snapshot can contribute. At the earliest representable positive calendar year,
return up to twelve valid buckets rather than fabricate year-zero/negative labels;
source maxItems allows fewer. Verify year-zero lexical/calendar handling and upper
exclusive-bound arithmetic before declaring input-contract completion.

TopProducts rank requested-month `salesAmount DESC, numeric productId ASC`, after
grouping all issue/return activity. Include zero-money and return-only candidates.
TopAgencies rank positive currentDebt DESC, numeric agencyId ASC. Use SQL LIMIT 10
after grouping/filtering, never WITH TIES. A tie does not expand to eleven rows.
Top-list subtotals need not equal company totals and cannot replace headline totals.
Ordering, inactive inclusion and period-scoped evidence are declared child-plan
conventions, not additional canonical query parameters.

## Money State Transitions

VERIFIED evidence is balance-neutral and excluded from cashReceived. Successful
issue posting consumes it with a single automatic receipt; separate receipt posting
moves it to RECEIVED_SEPARATELY with a receipt link. Both terminal evidence states
are excluded from the unreceipted sum. A transaction snapshot must see either the
old VERIFIED/unreceipted state or the committed receipt/terminal state, never both
or neither due to section query timing. Failed posting/rollback leaves evidence
unchanged. Include all retained VERIFIED confirmations regardless of newer issue
revision; do not hide them because the issue could not be delivered.

Cash is counted by receipt business period; unreceipted evidence by receivedAt
period. Therefore a cross-month separation can move an amount between differently
dated measures: do not claim their per-month sum is a conserved cash balance.
Provider success/event rows, browser returns, pending attempts and reservation
state alone do not constitute cashReceived/cashRefunded. Online receipts count
once from their posted document; CREDIT_APPLICATION is never new cash and
SALES_RETURN is never cashRefunded.

## Failure And Release Boundary

Use source 400/401/403/422/429/500 contracts and existing safe validation/errors.
No undocumented partial-200 fallback when one permitted section fails. Roll back
the read transaction, return a safe error, and never emit a partly constructed
body or credentials/provider data. No idempotency/precondition headers or export
formats are introduced. D09's interpretive ambiguity is resolved; lack of approval
for security-changing alternatives does not block the unchanged canonical behavior.
M29/M30 prerequisites and all implementation, verification and full-publication
gates remain open. This task does not mount a router or change canonical admission.
