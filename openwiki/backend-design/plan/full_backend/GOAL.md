# Active full-backend delivery goal

## Completed packet and next handoff — 2026-10-18

User requested M21 stock_adjustments core → M22 stock_counts → M23 sales_returns core
→ M24 agency_credit, including strict tests, review, Docker/Supabase and handoff.
All four six-file owning plans preceded their code. Implementations and actual-symbol
registers pass their declared gates:338offline+84PG (29owning+55retained)+24direct/Nginx.
Affected30-file production scope exact100%(1162statements/162branches); owning59cases
pass. Reproduced0006 protected-return-lot defect is repaired by
reviewed0007; populated upgrade/seed twice/54SQLchecks/down/up and reserved/paid
source cases pass. Configured Supabase explicitly upgraded0007; live integrity
preserves410documents/30agencies/24products. Docker Desktop, backend and frontend
are running healthy, direct/proxied readiness200. Runtime103target+2health.

All final nodes match current collection, with passing setup/call/teardown and no
required skips/xfails. Zero generated domain/metadata namespaces remain after guarded
cleanup; normal backend/frontend stay running. Read owning VERIFICATION and
full-backend VERIFICATION for commands, scope, review and frontend handoff. Prior705
baseline remains historical. Next module is M25 credit_applications after its owning plan;
M28/M29 and R4–R6/full154-operation goal stay open.

## Completed packet and next handoff — 2026-10-17

User requested `/goal implement the next 4 module with carefully testing`:
M17 stock_issues → M18 payment_receipts → M19 upfront_payments → M20 receivables.
The four owning six-file plans are prepared. HTTP/service/persisted-state/rollback/
multi-connection seams were explicitly confirmed. Use isolated Supabase test schemas;
do not create a Docker database. Implement and verify before publishing/closing gates.
Deployment baseline was Supabase0002/source0006. Configured Supabase is now explicitly
upgraded0006 and live integrity/read checks pass. M17–M20 owning80cases/exact100%
(808statements/98branches) and22direct/Nginx pass; all370retained PG/TLS nodes now
pass across checkpointed/resumed runs. Current total308offline+397PG/TLS=705non-deployment
cases; affected33production files exact100%(1285/306). All generated test schemas
are cleaned up, preserving410live documents/30agencies/24products. E11/E12 and R3
engineering gates pass. Full M29 corrections stay deferred. Next: expand M21
stock_adjustments' six-file plan before code; full154-operation/R4–R6 goal remains active.

**Set:** 2026-10-03 at the user's request. **State:** active implementation.

Deliver all 154 target operations and the two existing health operations following
[PLAN](PLAN.md), [EXECUTION](EXECUTION.md), and the canonical
[General Plan](../../GENERAL_PLAN.md). Completion requires the R6 release gate,
including real PostgreSQL state/rollback/concurrency evidence, exact contracts,
all persisted document kinds, historical correction reconciliation, exports,
sandbox recovery, and deployment evidence.

## Execution rules

- Carry existing uncommitted authentication/database/design work forward.
- Execute E01–E22 in prerequisite order; expand each owning child plan before code.
- Register actual symbols and tests, run the required checks, and record exact
  results before closing function, slice, operation, or release gates.
- Publish only complete operation branches supported by persisted history.
- Record progress and the next executable packet after each work session.

## Starting checkpoint

2026-10-03: source head 0003; runtime has seven auth and two health operations.
Frozen install, Ruff lint/format, and 122 offline tests passed. M02 is the active
prerequisite; M03–M32 and full release remain open. Session evidence belongs in
[M02 VERIFICATION](../shared_api/VERIFICATION.md).

## Current handoff

2026-10-03: E01/E02 and M03's part of E03 locally verified. Source head 0004;
complete five group operations published alongside health/auth. 159 default
offline, 105 PostgreSQL/TLS and 8 direct/Nginx deployment cases pass; 33-file
combined scope is exact 100% (1460 statements/362 branches). Migration/seed and
baseline 54 checks pass. Evidence: [shared](../shared_api/VERIFICATION.md),
[groups](../user_groups/VERIFICATION.md), [availability](AVAILABILITY.md).

## 2026-10-04 current handoff

M04 and E05 (M07/M08/M09) completed after preparing all four owning child plans.
Twenty new full operations are published: **32/154 target operations plus two
health operations**. Source/disposable deployment head **0005** adds unit-policy
serialization after a reproduced first-use race. Atomic users/session effects,
global district capacity, all-agency debt blockers and historical unit/reference
guards pass real state/rollback/races and exact runtime/source contracts.

**Verification:** 207 offline, 217 PostgreSQL/TLS and 16 direct/Nginx cases; combined
exact 100% (2173 statements/414 branches). Frozen sync, Ruff, fresh/populated
migration/downgrade/re-upgrade, zero metadata drift, seed twice and 54 SQL checks
pass. Evidence: [users](../users/VERIFICATION.md), [districts](../districts/VERIFICATION.md),
[types](../agency_types/VERIFICATION.md), [units](../units/VERIFICATION.md),
[availability](AVAILABILITY.md). External Supabase was not migrated by this task.

The above M04/E05 checkpoint is retained as history; see the latest handoff below.

## 2026-10-04 M05/M06/M10–M12 handoff

M05 completed before M06; M10 before products/agencies. All five owning six-file
plans existed before code. Twenty additional full operations now pass their
contracts, authorization, persisted-state/rollback, concurrency and per-file
coverage gates: **52/154 target operations +two health**, source/disposable head0006.
D16 uses canonical DerivedSellingPrice with a positive-Money storage seam; D02's
reviewed cascade preserves direct cache protection and all business history FKs.
0006 also closes first-use product and agency acceptance/history-date races.

**Verification:** 209 offline +283 PostgreSQL/TLS +18 direct/Nginx; combined exact
100% (2903 statements/484 branches), frozen sync/Ruff, fresh/populated migration/
downgrade/re-upgrade, seed twice and54 SQL checks pass. Review fixes include
post-claim replay authorization and exact recursively redacted audit JSON.
Evidence: [permissions](../permissions/VERIFICATION.md), [audit](../audit_logs/VERIFICATION.md),
[rules](../business_rules/VERIFICATION.md), [products](../products/VERIFICATION.md),
[agencies](../agencies/VERIFICATION.md), [availability](AVAILABILITY.md).

**Next:** expand M13 document_core's six-file plan, then implement E07 in owning
dependency order (M13→M14). Preserve D16's stored-price and D17's persisted-kind
publication gates in later writers. **Goal remains active; M13–M32 and R3–R6 are
open. R2 is locally verified.** External Supabase was not migrated by this task.

## 2026-10-05 M13/M14/M15-core handoff

E07/E08 completed in owning dependency order after all three six-file plans.
M13 internal foundations, M14 inventory and M15 receipt core pass exact contracts,
all7-kind/24-product reads, rollback and opposing races. Six additional full
operations are published: **58/154 target+2 health**. Shared history/line dispatch
remains M28; receipt posted corrections/full cancellation remain M29. No new
revision; source/disposable head0006.

**Verification:**219 offline+345 PostgreSQL/TLS+20 direct/Nginx; exact100%
(3622 statements/622 branches), frozen sync/Ruff, retained fresh/populated migration/
metadata tests, seed twice and54 SQL checks. D14 uses AggregateQuantity for valid
historical stock beyond storage range. Both review axes confirmed auth-error
propagation and direct frozen-content test fixes.
Evidence: [document core](../document_core/VERIFICATION.md),
[inventory](../inventory/VERIFICATION.md), [receipt core](../stock_receipts/VERIFICATION.md),
[availability](AVAILABILITY.md).

**Next:** expand M16 settlement_core's six-file plan, then E09/E10 FIFO/credit
provenance/reservations, chronological replay and persisted-kind capability register.
**Goal active; M16–M32, deferred M28/M29 operations and R3–R6 remain open.**
External Supabase was not migrated/deployed by this task.

## 2026-10-11 M16 settlement handoff

E09/E10 completed after preparing the owning [six-file plan](../settlement_core/PLAN.md).
Internal charge/FIFO/receipt/excess-credit/provenance/reservations and chronological
replay pass real state/rollback/observed races. Financial effects of existing returns,
credit applications and paid/active refund sources are explicitly registered.
New-lot ordering and cross-lot/origin/future-return protected provenance review
findings are fixed and regression-tested; both review axes confirmed closure.

**Verification:**617 non-deployment cases (247 offline+370 PG/TLS), exact100%
(4096 statements/830 branches); M16 adds28 offline+25 PG, scoped474/208 exact100%.
Frozen sync/Ruff and retained migration/seed/54-check tests pass at0006.
**Published operations remain58/154 +2 health.** No new route or migration;
the prior20 direct/Nginx cases were not rerun in this internal-only module task.
Evidence: [settlement](../settlement_core/VERIFICATION.md), [availability](AVAILABILITY.md).

**Next:** expand M17 stock_issues core's six-file plan, then E11's M17→M18→M19
dependency order. **Goal active; M17–M32, deferred M28/M29 operations and R3–R6 open.**
M23 still owns new return-line rounding/dependent revisions; M27 refund/provider
workflow; M29 full posted correction/cancel orchestration. No external Supabase
migration/deployment was performed.
