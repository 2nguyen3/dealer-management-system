# M30 Reports Plan

Prepared: 2026-10-28. Updated: 2026-10-29. Status: complete and published.
All five operations pass offline, real PostgreSQL, exports and deployment gates.
Delivery packet: E20. Full prerequisite: M29. Release bundle: R6, still open.

## Scope And Authority

Deliver the five canonical Reports GET operations, each with JSON, XLSX and PDF
representations. Eight production files and owning offline/integration tests now
exist. Exact commands, completed nodes, resource/layout evidence and publication
are recorded in VERIFICATION; whole R6 and frontend gates remain separate.

The authoritative HTTP contract is [API/openapi.json](../../API/openapi.json).
This plan does not replace it. Read [GENERAL_PLAN](../../GENERAL_PLAN.md),
[full-backend PLAN](../full_backend/PLAN.md), [MODULES M30](../full_backend/MODULES.md),
[EXECUTION E20](../full_backend/EXECUTION.md) and [DECISIONS D14](../full_backend/DECISIONS.md).
The owning companions are [REQUIREMENTS](REQUIREMENTS.md), [DESIGN](DESIGN.md),
[TESTS](TESTS.md), [CHECKLIST](CHECKLIST.md) and [VERIFICATION](VERIFICATION.md).

| Operation ID | Canonical path, below /api/v1 | Required allOf grants | Response schema |
| --- | --- | --- | --- |
| getSalesReport | GET /reports/sales | reports.read, sales.read | SalesReportResponse |
| getDebtReport | GET /reports/debt | reports.read, debt.read | DebtReportResponse |
| getInventoryReport | GET /reports/inventory | reports.read, inventory.read | InventoryReportResponse |
| getProductSalesReport | GET /reports/product-sales | reports.read, sales.read | ProductSalesReportResponse |
| getCashAndCreditReport | GET /reports/cash-and-credit | reports.read, debt.read | CashCreditReportResponse |

Five operations have fifteen format paths, not fifteen distinct operation IDs.
Formats are negotiated through Accept, not a new export route or query parameter.

## Current Boundary

The M29 prerequisite is complete: all twelve owning correction/cancel operations
are published with original-period/state/rollback/race and deployment evidence.
M30's five normal-app routes are now deployed on existing dms. Runtime has152/154
business operations plus2health at source/image/configured Supabase0009; dashboard
and chatbot alone remain unpublished. No M31 implementation or whole-release claim
is made. Earlier source-only and partial-publication checkpoints are historical.

## Delivery Sequence

1. Reconcile M29 handoff and resolve M30-RD01's bounded historical inventory schema
   gap against the canonical contract, with a real historical witness when later
   implementation/testing is authorized. Do not modify immutable SQL to hide it.
2. Implement exact typed report schemas, required half-open period/filter parsing,
   authorization dependencies and five parameterized query projections. First
   internal vertical slice: sales JSON, including company denominator and totals.
3. Add debt, inventory and product-sales JSON using independent ledger/line
   references, then cash/credit using separate cash, credit and evidence aggregates.
   Register actual symbols as introduced, not after the module is called complete.
4. Add common full-filter detached datasets and XLSX/PDF renderers; resolve the
   uninstalled XLSX writer decision before dependency/lockfile changes. No exports
   may be derived by concatenating independently fetched public JSON pages.
5. Run the scoped future offline, existing-Supabase UUID-schema, multi-connection
   snapshot, renderer and retained-consumer gates in TESTS. Record failures and
   successful replacements without treating partial runs as complete.
6. Only after complete operation gates, integrate the five owning handlers into
   the existing API aggregator. Any future deployment uses only existing dms
   services after notice; direct/proxy evidence and actual availability must agree.
7. Update owning and general trackers with evidence, then hand exact reusable
   query projections to M31 without inheriting reports.read at its HTTP boundary.

## Actual Ownership

Paths are relative to backend. Existing WIP was preserved and extended under the
assigned reports paths. The parent owns API aggregation, canonical contract and deployment.

| Planned file | Responsibility |
| --- | --- |
| app/modules/reports/schemas.py | Period/filter inputs, canonical five row/response models and detached dataset type |
| app/modules/reports/queries.py and repository.py | Five fixed SQL projections and ReportQueries.read/statement plus named methods; bound SQL, metadata sentinel, detached rows |
| app/modules/reports/service.py | ReportService.read; validation, authorization boundary, cursor/page construction and materialization |
| app/modules/reports/dependencies.py | get_report_service; existing session, live principal/grants and CursorCodec injection |
| app/modules/reports/router.py | Five canonical get_*_report handlers, media selection and response delegation |
| app/modules/reports/exporting.py | negotiate_report_media, render_report/render_xlsx/render_pdf, explicit text cells, lossless continuations and safe headers |
| app/api/router.py | Eventual report-router aggregation only after operation readiness |

No duplicate ORM mappings, report tables, materialized monthly balances, cache
writes, allocation replay, provider adapter, scheduler or background export job.
Reuse app.common values/schemas/dates/pagination and live auth policy; reuse
ReportLab and the existing licensed NotoSans font, not network font downloads.

## Decisions And Constraints

- M30-RD01 canonical/runtime aggregate refs are aligned in shared WIP; the real
  historical witness remains a required isolated PostgreSQL gate.
- M30-RD02 through RD07 are implemented; exact Python gates pass. SQL semantics,
  immutable-ledger oracles and concurrent snapshots require their own PG evidence.
- Offline tests and actual export rendering run in-process. PostgreSQL verification
  waits for the parent's explicit serialized-slot release and is restricted to UUID schemas in the existing
  configured Supabase database with SUPABASE_TEST_SCHEMAS=1. No CREATE DATABASE,
  local PostgreSQL, new server/container/service/tunnel or parallel composition.
- Preserve seeded history, the recorded receipt774/payment37 evidence, credentials,
  frontend work and data/. No reset, seed rerun against live data, commit or push.
- Existing shared WIP declares and locks XlsxWriter; this worker did not change
  dependencies, locks, environment, providers, API aggregator or M29 services.

## Completion Meaning

Completion requires all five operations and all three formats with exact independent
reconciliation, canonical-schema alignment, permission parity, full-filter exports,
real snapshot isolation evidence, exact per-file statement/branch coverage and
existing-service deployment evidence. Planning, historical M29 test counts and
mocked responses satisfy none of those implementation gates. F30/browser, M31/M32
and whole R6 completion remain separate.
