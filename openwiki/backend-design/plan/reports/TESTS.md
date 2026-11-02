# M30 Reports Test Plan

Prepared: 2026-10-28. Updated: 2026-10-29. Complete/published:191owning offline cases
pass within1083full offline; all11unique owningPG nodes pass across serial resumes.
Reports438statements/98branches, aggregator66/0 and shared responses48/18 are exact
per-file100%. Normal-app PostgreSQL HTTP/resource rerun and direct/proxy/public
exports pass. Historical planned rows retain intent, not current pass status;
actual registers and VERIFICATION are authoritative.

`tests/reports/test_pdf_geometry.py::test_rendered_pdf_word_boxes_are_inside_page_and_do_not_overlap`
is an explicitly selected integration/tool test, not part of default offline count.
Actual pdftotext boxes inspect every word for bounds/overlap; actual pdftoppm/Pillow
renders inspect every page's ink margins and validate the Vietnamese font glyph map.
It complements pypdf exact text/digit/continuation/heading/footer checks. This is
automated inspection of rendered output, not a human or image-capable model review.
The command/artifacts and the retracted earlier image-read claim are in VERIFICATION.

## Verification Rules

Every completed callable, constructor, validator, generated permission dependency,
query branch, renderer and route needs actual file:symbol -> test-node registration
with success/failure/boundary assertions. Replace proposed names with actual names
as code is introduced; add every extra helper before closing its implementation.
No required skip/xfail, interrupted worker log or unexecuted test closes a gate.

Future tests must use existing configured Supabase UUID schemas only, explicitly
SUPABASE_TEST_SCHEMAS=1, and existing dms services for deployment. Inspect harnesses
before invocation; no CREATE DATABASE, new PostgreSQL/container/server/tunnel,
parallel verification runtime or provider acceptance helper. This task executes
none of these tests or commands. Fixture writes stay in owned UUID schemas;
live receipt774/payment37 and seeded history remain untouched.

## Planned Symbol Register

| Planned symbol, under app/modules/reports | Success | Failure | Boundary |
| --- | --- | --- | --- |
| schemas report input validators and five row/response models | T01 canonical examples/ref schemas | T01 invalid/extra/type/range values | T02 huge aggregates, zero/negative net, RD01 witness |
| dependencies.get_report_service and three generated allOf dependencies | T03 exact grant pair, injected session/codec | T03 each missing/false grant, revoked session | T03 management without grants, format parity |
| repository.ReportQueries.__init__ and .sales | T04 full rows/company/totals | T04 propagated safe query failure | T04 empty filter, return-only, ties, huge sums |
| repository.ReportQueries.debt | T05 all four movement kinds | T05 failure/no partial dataset | T05 opening-only excluded, reversal-only net zero, historical >10^18 |
| repository.ReportQueries.inventory | T06 four source kinds/equation | T06 query failure/no cache fallback | T06 inactive/zero product, mixed units, >10^15 history |
| repository.ReportQueries.product_sales | T07 line amounts/quantities | T07 failed projection/no rerounding fallback | T07 zero-VND return, return-only, three decimals |
| repository.ReportQueries.cash_and_credit | T08 separate CTE reconciliation | T08 failure/no partial joins | T08 multi-lot fanout, evidence midnight, current-only fields |
| service.ReportService.__init__ and .read | T09 five dispatches/typed projections | T09 bad report/sort/cursor/authorization | T09 limit 1/100, empty/all export controls ignored |
| exports.negotiate_report_media | T10 each media/q preference | T10 unsupported/invalid/all q=0 | T10 wildcards, exact exclusion, missing Accept/ties |
| exports.ReportExportService.__init__ and .render | T11 detached all-row dataset | T11 renderer exception/cleanup | T11 no Session/lazy load; empty/101+ rows |
| exports.render_xlsx and any cell/chunk helpers | T12 valid workbook/exact fields | T12 output/temp failures | T12 injection/long text/sheet rollover/large exact values |
| exports.render_pdf and any footer/layout helpers | T13 glyph/text/layout | T13 missing font/build failure | T13 multi-page/long tokens/wide cash fields |
| exports.export_headers | T14 correct media/disposition | T14 unsafe report identifier rejected | T14 UTF-8, CRLF/path payloads, fixed names |
| router.get_sales_report/get_debt_report/get_inventory_report/get_product_sales_report/get_cash_and_credit_report | T15 exact delegation/models/headers | T15 400/401/403/406/422/429/500 | T15 all 15 format paths, no new body/header requirements |

Existing shared helpers are not claimed newly tested by naming them. Include any
changed shared file in scoped coverage and rerun its owning behavior selection.

## Actual Core Symbols: 2026-10-28

The following register supersedes only the planned schema/query/service rows above.
Core implementation is isolated; this worker did not edit router, authorization,
rendering, canonical API or M29 files. The tests below are offline, with mocked SQL
results and no Settings/database/provider access. They prove Python projection,
validation, SQL binding construction and paging, NOT PostgreSQL query semantics,
ledger reconciliation, real snapshot isolation, runtime publication or full M30.
The T04-T08/T16-T18 real-database gates remain required and are not claimed passed.

Paths in the symbol column are under `backend/app/modules/reports/`; test paths
are under `backend/`. Every parameter of the cited parametrized node is included.

| Actual symbol | Success test nodes | Failure test nodes | Boundary test nodes |
| --- | --- | --- | --- |
| `schemas.py:ReportInterval`, `ReportInterval.valid_interval`, `ReportPeriod` | `tests/reports/test_schemas.py::test_catalog_filters_and_strict_period`, `::test_canonical_models` | `::test_catalog_filters_and_strict_period`, `::test_period_requires_aware_generated_at_and_identity_types` | Leap day, non-month range, equal/reversed dates, aware generatedAt in the same nodes |
| `schemas.py:SalesFilters`, `DebtFilters`, `InventoryFilters`, `ProductSalesFilters`, `CashCreditFilters` | `tests/reports/test_schemas.py::test_catalog_filters_and_strict_period`; `tests/reports/test_paging.py::test_filter_validation_is_per_kind_including_export` | `tests/reports/test_schemas.py::test_filter_ids`; `tests/reports/test_paging.py::test_filter_validation_is_per_kind_including_export`, `::test_business_validation_and_projection_failure` | BIGINT/CatalogId maxima, zero/leading-zero/overflow/bool IDs, unknown per-kind filters, export filter parity |
| `schemas.py:AgencyReportIdentity`, `ProductReportIdentity`, `SalesReportRow`, `DebtReportRow`, `InventoryReportRow`, `ProductSalesReportRow`, `CashCreditReportRow` | `tests/reports/test_schemas.py::test_canonical_models` | `::test_exact_numbers_reject_lossy_inputs`, `::test_count_is_nonnegative_integer`, `::test_percentage_boundaries`, `::test_period_requires_aware_generated_at_and_identity_types`, extra-field rejection in `::test_canonical_models` | `::test_unbounded_exact_aggregates_and_historical_inventory`: >28-digit sums, negative net, 1.2e15 opening/closing, 0.001, zero normalization; aliases reject float/scientific/nonfinite values |
| `schemas.py:ProductSalesTotals`, `SalesTotals`, `DebtAmounts`, `CashCreditAmounts`, `SalesReportResponse`, `DebtReportResponse`, `InventoryReportResponse`, `ProductSalesReportResponse`, `CashCreditReportResponse` | `tests/reports/test_schemas.py::test_canonical_models`; `tests/reports/test_paging.py::test_dispatch_totals_and_empty_metadata` | `tests/reports/test_paging.py::test_business_validation_and_projection_failure` (invalid row never returned), inherited exact-value/interval rejection nodes above | `tests/reports/test_paging.py::test_numeric_sort_is_exact_and_totals_cover_full_population`, `::test_every_sort_and_tie_page`: all-filter totals, empty company denominator, integer counts, no inventory totals |
| `queries.py:SALES`, `DEBT`, `INVENTORY`, `PRODUCT_SALES`, `CASH_AND_CREDIT`, `REPORT_SQL` (fixed projections, not callables) | `tests/reports/test_paging.py::test_repository_single_bound_statement_detaches_and_closes`, `::test_sql_snapshot_and_source_guards` | `::test_repository_failures_close_results_without_transaction_side_effects` | One bound SELECT, null-row metadata sentinel, no artificial LIMIT/storage cast/write locks, current-vs-ledger source guards, receivedAt Vietnam boundary SQL. SQL content is inspected, not executed by these tests |
| `repository.py:ReportQueries.__init__`, `ReportQueries.statement`, `ReportQueries.read`, `ReportQueries.sales`, `ReportQueries.debt`, `ReportQueries.inventory`, `ReportQueries.product_sales`, `ReportQueries.cash_and_credit` | `tests/reports/test_paging.py::test_repository_single_bound_statement_detaches_and_closes` (every kind) | `::test_repository_failures_close_results_without_transaction_side_effects` (every kind; execute and materialization exceptions, invalid statement key) | Same success node covers empty/nonempty rows, detached bigint strings, maximum numeric filter binding, result close, no own commit/rollback |
| `service.py:ReportService.__init__`, `ReportService.read`, nested `ReportService.read.keys` | `tests/reports/test_paging.py::test_dispatch_totals_and_empty_metadata`, `::test_every_sort_and_tie_page`, `::test_product_default_is_descending_sales` | `::test_json_invalid_limit_never_queries`, `::test_json_invalid_sort_never_queries`, `::test_cursor_scope_tamper_and_anchor_changes`, `::test_business_validation_and_projection_failure` | `::test_hundred_row_page_limit_and_fractional_sort`, `::test_numeric_sort_is_exact_and_totals_cover_full_population`, `::test_export_ignores_all_page_controls_and_has_no_cap`: limits 1/100, tie ID direction, removed/changed anchors, >28-digit integer totals under Decimal precision=2, 105 full export rows and all invalid paging controls ignored |

Chosen core interfaces are `ReportQueries(session).read(kind, from_date, to_date,
filters=None)` and the five named query methods with `(from_date,to_date,filters=None)`.
They return detached `{generatedAt,rows,companyGrossSales?}`. `statement(kind)` exposes
the complete bound TextClause so M31 can nest projections in ONE outer statement;
repeated method calls are not a coherent multi-section snapshot. SQL metadata uses
`__generatedAt` and sales-only `__companyGrossSales`; empty projections retain one
null-ID sentinel that `read` removes. Queries do not authorize or commit/rollback.

`ReportService(session,codec).read(kind,from_date,to_date,filters=None,cursor=None,
limit=25,sort=None,export=False)` returns the typed canonical response. Export returns
`{kind,title,period,filters,columns,rows,totals}`; columns are `(key,label)` pairs,
rows/totals are validated exact JSON scalars, inventory totals is `None`, IDs ascend,
and invalid/stale cursor/limit/sort are entirely ignored. Full filtered rows are
materialized once, with exact integer money/count sums and in-memory keyset pages.
This deliberately has no hidden cap and uses O(full-result) memory; resource/load
measurement remains a later gate. Caller owns releasing the read before rendering.

Actual offline command, run from `backend/` with dedicated coverage storage:

```powershell
$env:COVERAGE_FILE = '../data/backend/m30-core-offline.coverage'
uv run --frozen --no-sync pytest tests/reports/test_schemas.py tests/reports/test_paging.py -q --tb=short --cov=app.modules.reports.schemas --cov=app.modules.reports.queries --cov=app.modules.reports.repository --cov=app.modules.reports.service --cov-branch --cov-report=term-missing --cov-report=json:../data/backend/m30-core-offline-coverage.json --junitxml=../data/backend/m30-core-offline.xml
```

Result: **100 passed**, no skips/xfails. Per-file Python coverage is exact 100%:
schemas 96 statements/0 branches; queries 6/0; repository 39/6; service 61/20;
total 202 statements/26 branches, no missing/partial arrays. The six assignments
in queries.py are not proof that SQL ran. Initial 89-case run had 80 passes/9 test
assertion failures from using nonexistent `ApiError.status_code`; corrected tests
use existing `ApiError.status`, then 89 passed before the final boundary additions.
Ruff check and format--check pass for the five owned production files and these
two tests. No PG, server, provider, migration, dependency, commit or publication
command was run by the core worker; all PostgreSQL/snapshot/release claims remain
with their owning integration evidence, not this offline actual-symbol record.

## Actual Transport And Export Register: 2026-10-29

Paths are under `backend/`; every parameter of the cited node is included. These
rows plus the core register cover all production callables. No ReportExportService
class or exports.py exists; the actual file is exporting.py.

| Actual symbol, under app/modules/reports | Success/failure/boundary nodes |
| --- | --- |
| dependencies.py:get_report_service | tests/reports/test_http.py::test_report_dependency_checks_limiter_and_uses_existing_signing_key; ::test_rate_limiter_and_safe_errors_prevent_partial_binary_response (injected limiter denial); codec/session injection |
| router.py:SalesReader/DebtReader/InventoryReader generated allOf dependencies | tests/reports/test_http.py::test_every_report_has_both_grants_for_json_and_binary; ::test_unauthenticated_reports_never_lookup_or_render_for_any_format; missing/false report and domain grants for all formats, no role bypass |
| router.py:report_contract, report_responses | tests/reports/test_http.py::test_report_json_response_and_contract_preserve_all_filters; all five OpenAPI operations/sorts, three media, Content-Disposition metadata |
| router.py:read_report and get_sales_report/get_debt_report/get_inventory_report/get_product_sales_report/get_cash_and_credit_report | tests/reports/test_http.py::test_every_export_ignores_paging_and_releases_transaction_before_render; ::test_json_page_size_is_validated_before_lookup; ::test_report_json_response_and_contract_preserve_all_filters; ::test_rate_limiter_and_safe_errors_prevent_partial_binary_response; five delegations, business filters, safe 400/422/429/500, headers and release-before-render |
| exporting.py:negotiate_report_media | tests/reports/test_exports.py::test_negotiate_report_media; ::test_negotiation_rejects_unacceptable_or_malformed_quality; exact exclusion, wildcards, ties, missing and malformed Accept |
| exporting.py:_text, _metadata, _chunks | tests/reports/test_exports.py::test_exact_scalar_formatting_and_float_rejection; ::test_every_report_all_rows_exact_values_and_security_headers; ::test_xlsx_long_text_continuations_sheet_rollover_and_reconstruction; ::test_pdf_newline_continuations_fit_pages_and_always_repeat_record_identity; zero/float/date/Decimal, supplementary Unicode, newline and character boundaries |
| exporting.py:_xlsx_table, render_xlsx | tests/reports/test_exports.py::test_every_report_all_rows_exact_values_and_security_headers; ::test_empty_inventory_without_totals_is_valid; ::test_xlsx_injection_and_exact_numeric_policy_without_apostrophes; ::test_xlsx_long_text_continuations_sheet_rollover_and_reconstruction; ::test_xlsx_stable_identity_does_not_depend_on_column_order; ::test_render_failure_returns_no_partial_attachment_and_closes_memory; ::test_xlsx_never_creates_temporary_files |
| exporting.py:report_page_footer | tests/reports/test_exports.py::test_landscape_footer_uses_actual_page_width_and_restores_canvas; PDF tests assert every actual page number |
| exporting.py:render_pdf and nested paragraph | tests/reports/test_exports.py::test_every_report_all_rows_exact_values_and_security_headers; ::test_pdf_empty_names_and_large_exact_values; ::test_pdf_wide_groups_long_tokens_markup_and_single_column; ::test_pdf_newline_continuations_fit_pages_and_always_repeat_record_identity; ::test_render_failure_returns_no_partial_attachment_and_closes_memory; actual Vietnamese, long digits/tokens/newlines, escaped markup, groups, footer and missing-font/build failures |
| exporting.py:render_report | tests/reports/test_exports.py::test_every_report_all_rows_exact_values_and_security_headers; ::test_render_report_rejects_json_with_clear_caller_contract; ::test_unsafe_kind_rejected_before_renderer; ::test_render_failure_returns_no_partial_attachment_and_closes_memory; completed bytes, fixed safe filename, reject unsafe kind, no partial return |

`tests/reports/test_resources.py::test_canonical_wide_report_resource_measurement_and_visual_artifacts`
passes the canonical 105-row cash-credit service projection through both actual
renderers, records peak Python memory/timing/bytes, and saves visual artifacts.
Its query is mocked; it is not actual SQL performance evidence.

The shared `tests/reports/conftest.py:report_resource_artifacts` fixture creates
fresh PDF/XLSX/measurement files in pytest-managed temporary storage. The resource
test requests it after switching to an empty working directory; the geometry test
requests the same fixture directly and no longer depends on a previous test run or
an ignored repository data directory.

`tests/integration/reports/test_queries.py::test_sales_rate_rounds_once_with_exact_integer_arithmetic`
executes the actual SALES percentage projection on PostgreSQL against zero/full/
one-third, below/tie/above half-up boundaries and 51-digit aggregate operands.
An independent 100-digit Decimal oracle checks all eight cases. The offline SQL
source guard registers the exact integer-division projection; it does not substitute
for this actual PostgreSQL test.

### Implemented PG Selection, Pending Serialized Execution

- `tests/integration/reports/test_queries.py`: all five queries versus independent
  source/line/signed-ledger oracles in three half-open periods; every cash/debt
  amount and total, sales rates/company denominator, filters/pages, inactive historical
  inventory witness and Vietnam-midnight evidence boundaries.
- `tests/integration/reports/test_http.py`: 101 matching agency/product populations
  created by guarded session-local builders in the UUID schema; all five reports,
  live grant pairs, full canonical XLSX row/totals equality, actual PDF values/totals,
  page controls ignored and one-statement/time/byte observations.
- `tests/integration/reports/test_replay.py`: owning real M29 goods/negative adjustment/
  manual cash, issue+auto-receipt, paid return and credit moves/cancels; append independent
  five-report checks at every committed stage without removing M29's own assertions.
- `tests/integration/reports/test_snapshot.py`: retain the original detached-result
  test, plus an in-flight SQL barrier. A UUID-schema function emits an observed server
  notice and waits on a test-only advisory lock after the statement snapshot starts;
  a second connection commits an M29 date move, reservation release or evidence
  separation. Production SELECTs themselves have no added locks or barrier function.
- `tests/integration/reports/test_readonly.py`: full persisted snapshots around
  success/cursor/query/render failures, no partial attachments, connection checkout
  cleanup and PostgreSQL READ ONLY execution of all five projections.

No node in this subsection is a pass claim before its completed XML is recorded.

## Offline And Contract Cases

T01: Load canonical openapi.json refs using the existing jsonschema dev dependency;
assert exact operation IDs, x-permissions, filters, sort enums, defaults, required
period and response properties. Cover omitted/duplicate/unknown query handling as
selected by existing transport conventions. Reject malformed/leap-invalid dates,
fromDate>=toDate, ID zero/negative/leading-zero/BIGINT overflow, invalid CatalogId,
JSON limit 0/101 and unsupported sort; accept real leap-day/non-month ranges.
No Idempotency-Key/If-Match or request body is required for GET. RD01's contract
gap must remain visible until the actual canonical change is reviewed and tested.

T02: Reject float/NaN/Infinity/scientific string paths, preserve exact strings,
CatalogId/count integers and fixed-point <=3 quantity/<=4 percentage decimals.
Exercise aggregates >10^18 and >28 digits, >10^15 historical inventory, signed net,
zero normalization and 1/3 share rounding. Confirm individual stored/current
Money/Quantity policies remain bounded despite widened report aggregates.

T03: For every operation x format, test unauthenticated 401 and allOf combinations:
no grants, reports.read only, domain grant only, other domain grant, exact pair,
false/missing permission row, MANAGEMENT without pair, live session invalidation
and next-request grant revocation. A denied request never invokes ReportQueries or
renderer and does not leak filter existence. No extra agency.read/product.manage
or receipt/refund post grant needed for authorized report identities.

T09-T10: Every JSON sort direction, numeric ties resolved by ID, cursor tamper,
foreign report/period/filter/sort, removed/changed anchor and limit+1 boundaries.
Totals unchanged between pages when source data is unchanged; no frozen-snapshot
promise across mutations. Export ignores valid/stale/foreign cursor, limit and page
sort, but still rejects invalid business dates/filters. Explicitly test page-only
invalid values are ignored for export under RD07 instead of framework validation
accidentally imposing JSON restrictions. Media matrix includes missing header,
*/*, application/*, q ordering/ties, exact q=0 with wildcard q>0, malformed q and
text/html/text/csv-only 406. Use established safe error/request-ID middleware.

## PostgreSQL And Independent Oracles

T04: Two agencies with duplicate names, multiple issues and multi-line issue;
current header counted once. Issue gross 100 and 300 gives companyGrossSales 400
and first agency salesRate 25 even with agency/type filter and limit=1. Filters
matching no rows keep companyGrossSales 400 with other totals zero. Return-only
period gives count/gross/rate zero, positive return and negative net. Draft,
pending, canceled and superseded revisions never count as current sales.

T05: Separate CHARGE/PAYMENT/RETURN/CREDIT legs with independently computed signed
opening/period/close, terminated/duplicate-name agencies, current type/district
changes and opening-only debt exclusion. Online full cash greater than allocated
debt affects cash report but only allocations affect cashApplied. A completely
reversed old source leaves no ghost period row. Check every DebtAmounts total.

T06: Receipt, issue, return and both signed independent/count adjustment movements;
reverse each source in a later wall-clock month. Independent all-entry sums must
match source-kind components and closing equation, with no reversal as a receipt.
Month/year/leap boundaries, inactive product/unit, zero/no-ledger product policy,
fractional unit, multiple different units and huge opening/closing. Reuse the
historical 600000000000000 receipt, later 500000000000000 issue, backdated second
600000000000000 receipt shape: historical 1200000000000000 vs current 700000000000000.
Assert both report JSON fields fit reviewed canonical aggregate refs after RD01,
and current cache still retains its storage bound. No DDL bypass or cache writes.

T07: Product sold/returned quantities and stored issue/return line amounts against
an independent current-line scan; duplicate product names never merge. Include
fractional cumulative rounding with a positive-quantity zero-VND return, return-only
product, different issue/return months, current product-price/rate/name changes,
optional agency/product filters and money-only totals. No summed mixed-unit quantity.

T08: Manual/auto/separated/online full receipts, return credit, credit application,
confirmed refund, PENDING/UNKNOWN/FAILED attempts, ACTIVE/RELEASED/CONSUMED
reservations, VERIFIED/CONSUMED/RECEIVED_SEPARATELY upfront. Multi-receipt/multi-lot/
multi-reservation fixtures expose fanout; independent per-source aggregates verify
every CashCreditAmounts field. Credit application cashReceived=0; return
cashRefunded=0; pending refund cashRefunded=0 while reserved stays positive.
Verified receipt separation transitions from evidence to full cash exactly once.
receivedAt just before/at local midnight and at exclusive toDate uses UTC+07,
not server timezone or verifiedAt. Include historical closing different from current
credit/reservations, opening-only/current-only populations and no-activity empties.
Move a same-return successor across months while retaining lot/source/receipt IDs;
credit period follows effective ledger entries, not original lot metadata.

T16 original-period integration: Use real M29 services in UUID fixtures, including
the remaining issue/upfront/return/credit branches only when their owning gates
permit. Capture before/after independent raw signed-ledger sums and current header/
line scans across at least two periods; do not reuse production report functions
as the only expected-value oracle. Correct/move/cancel each relevant goods/manual/
issue/return/credit source; canceled adjustment/count restrictions stay enforced.
Verify replacements restate old periods, returns remain in return periods, auto
receipt synchronization/separation preserves actual cash and reservations/paid
refund origins survive. Run JSON/XLSX/PDF against the same committed fixture and
compare all logical rows/totals, not just balances at now. Compare unchanged
immutable revisions/lines/lots and audit/command state, not a count-only witness.

T17 real two-connection snapshots: Insert a barrier into the actual query execution
and commit a competing M29 date move or receipt/refund/evidence separation from a
second connection. A single response is wholly before or wholly after, never
old page/new totals or cash plus its already-consumed evidence. Test concurrent
reservation changes with historical closing unchanged. Use observed synchronization,
not time sleeps/mocked concurrency. No blocking writer locks should be acquired by
report reads. Future requests may see the new state and invalidate old anchors.

T18 read-only/persisted safety: Before/after snapshots of document revisions,
ledger entries, balances, reservations, immutable receipt/payment and command/audit
business rows stay unchanged by success, invalid cursor, canceled request, query
failure or rendering failure. Inject failures after materialization and during
render; session resources close and no partial dataset is returned. Fixture setup
commits/rollbacks are test-owned, not report side effects.

## Export Evidence

T11-T12: At least 101 matching rows for EVERY report (test products/agencies only
inside UUID schemas) and independent full totals. Send JSON limit=1/cursor/sort then
export with those page controls and confirm all logical rows in ID order. Empty
XLSX/PDF valid; export schema matches JSON fields, filter/period labels and units.
Use zipfile/XML inspection for XLSX: no formula `<f>`, hyperlink, macro or external-link
parts; exact text types/contents for IDs 9223372036854775807, 10^18+ sums, >28-digit
totals, -net, quantity 0.001 and percentages. Formula payloads include =SUM(...),
+cmd, -1+2, @SUM(...), leading spaces/tab/CR/LF, DDE-looking text and URL schemes.
Actual Vietnamese examples include "Đại lý Nguyễn Ánh" and "Đơn vị lẻ"; round-trip
Unicode without normalization/data loss. Test XML escaping, unbounded long TEXT
continuations (>32767 characters), sheet row rollover and exact reconstruction,
disk/spool failure and workbook-close failure. No apostrophe-prepending that changes
the source value is needed when explicit string types are used.

T13: Extract real generated PDF text with existing pypdf, then inspect rendered
pages for Vietnamese glyphs, all digits, repeated headings, wrapped long tokens,
wide cash/debt groups, row continuations, footer placement and totals. Missing font,
malformed markup-like names and output failures must not yield partial 200.
No remote image/font/URL request. Page count/font registration alone is insufficient
visual evidence; record actual tool/artifact and any unrun visual gate explicitly.

T14-T15: Correct three media types, safe Content-Disposition fallback/filename*,
Vary Accept, no-store, nosniff, CORS exposure and request IDs. Failure before render
completion returns safe JSON error, no attachment success headers/body. Verify
response completion/disconnect cleanup with zero leaked temporary files/connections.
Resource tests record query count, row/byte count, peak memory/spool behavior and
query/render elapsed time; no invented performance threshold or silent truncation.

## Coverage And Release Gates

Planned test locations are tests/reports/, tests/integration/reports/ and an owning
tests/deployment/ report selection. They are not created here. Future exact command
lines/node selections must be recorded after files exist, from backend, using
locked/no-sync execution where applicable. No future command is a completed run.

Require exact 100% statements and branches per affected production file, no
exclusions/partial branches, across app/modules/reports plus changed shared/router
files. Record exact include list, statement/branch counts, missing/partial arrays,
source checkpoint and coverage artifacts; do not preassign counts. Repeated tests
are a verified union, not added twice. Test constructors/validators/cleanup too.

Retain affected M14/M20/M24 statement, M28 printing/auth/value/cursor and M29
correction/period regressions by explicit owning node list. Do not rerun unrelated
historical baselines solely to repeat old counts. Missing required environment
fails selected setup rather than silently skipping; it grants no permission to
create a prohibited environment.

Deployment is a later gate, not performed here: existing direct 8000/proxy 8080
only, after explicit notice if updating the existing backend artifact is needed.
Check five source operation IDs, all fifteen formats, authorized and denied
requests, headers and runtime-role reads without mutating live business data.
If the current deployment has insufficient rows for full-filter stress cases,
retain schema integration evidence rather than invent live data. No provider calls,
seed reset, frontend rebuild or new service. Full M30 and M31 handoff remain open
until evidence and availability trackers are actually aligned.
