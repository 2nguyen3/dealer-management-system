# Full backend program checklist

Use the [General Checklist](../../GENERAL_CHECKLIST.md) for M01–M32 implementation
status. This checklist tracks execution-design and whole-program acceptance.

## Planning package

- [x] Inspect working-tree backend, UI, deployment and relevant OpenWiki authorities.
- [x] Record implemented auth/database versus future business/UI behavior.
- [x] Specify all 32 work packages, dependencies and per-slice failure/race gates.
- [x] Inventory all 154 target operations with one owner and first/full delivery gate.
- [x] Define transaction, locking, retry, replay, provider and reporting architecture.
- [x] Record schema/contract gaps and decision owners, including cache deletion.
- [x] Prepare detailed M02 child materials and the first implementation sequence.
- [x] Deep-review the existing plan and add delivery packets, mixed-history release
  gates, derived-price mismatch and precise frontend handoffs in EXECUTION.
- [x] Pass plan validator, local link/reference checks and whitespace validation;
  record exact results in VERIFICATION before checking this item.

## Decisions and readiness before code

- [x] M02: reproduce durable command/ETag/audit/header requirements and verify auth
  extraction compatibility, head-compatible seed/verifier and test harness.
- [x] M04/M07/M08/M09: owning child plans before code, actual-symbol registers,
  complete-operation state/race/contract/coverage/deployment gates; [checkpoint](../users/VERIFICATION.md).
- [x] M11/M12: reproduce D02 and verify reviewed deletion migration with direct
  cache-delete rejection and concurrent reference insertion.
- [x] M10/M11: resolve D16 derived selling-price representation in the single source
  contract and affected projections before publication.
- [x] M13/M14/M15 core: six-file plans, actual-symbol registers, exact contracts,
  state/rollback/opposing races and deployment pass; [evidence](../stock_receipts/VERIFICATION.md).
- [x] M14: reproduce and resolve D14 historical statement balances beyond stored
  quantity range through canonical AggregateQuantity, retaining storage limits.
- [x] M16 E09/E10: owning plan/actual symbols, chronological financial replay,
  exact provenance/reservations and seven-kind capability register pass real PG
   state/rollback/races, review regressions and100% coverage; [evidence](../settlement_core/VERIFICATION.md).
- [x] M17–M20 E11/E12: owning plans/actual symbols,80owning cases/exact100%,
  370retained PG/TLS passes,308offline and22deployment; affected33-file production
  scope exact100%(1285/306), configured Supabase0006 live integrity and cleanup.
- [x] M21–M24: owning plans/actual symbols,59owning cases,338offline+84PG+24direct/Nginx,
  exact30-file1162/162 coverage, deployed0007 and live integrity/cleanup;
  [packet evidence](VERIFICATION.md).
- [x] M16/M23: resolve exact chronological replay/provenance representation and
  immutable dependent-return revision protocol against real SQL guards; reviewed0007
  preserves original immutable lots and reserved/paid sources.
- [ ] M16 and every writer: D17 persisted-kind register and mixed-history deployment
  gates verified; no incomplete writer published as full behavior.
- [ ] M26/M27: identify accepted deployed sandbox and persist recovery/actor metadata;
  record real transport and deployed sandbox evidence distinctly.
- [ ] M31: resolve D09 dashboard admission/section permission discrepancy in source.
- [ ] M32: resolve D10 chatbot candidate continuation without widening profile access.
- [ ] Before each later module: expand its work package into owning six-file plan,
  exact lock/query design and proposed-to-actual symbol register.

## Delivery milestones

- [x] R1: shared foundations and real retry/precondition races pass;
  [evidence](../shared_api/VERIFICATION.md).
- [x] R2: complete administration/catalogue/agency operation inventories pass locally;
  [exact contracts/state/races/coverage/deployment](VERIFICATION.md#2026-10-04-m05m06m10m12-completion).
- [x] R3: document/stock/cash/upfront/receivable core passes chronological replay gates;
  [scoped engineering evidence](VERIFICATION.md#2026-10-17-m17m20-completion-and-retained-regression-closure).
- [ ] R4: counts/returns/credit/sandbox/refunds pass provenance and recovery gates.
- [ ] R5: complete all history/print and posted correction/cancel paths; close every
  affected owning module's deferred operation inventory.
- [ ] R6: report/export/dashboard/chatbot and final release checks pass.

## Whole-backend completion

- [ ] All 154 operations and all target state/media/permission branches implemented.
- [ ] Every actual callable has success/failure/boundary evidence and declared
  per-file 100% statement/branch gate; no required skips/xfails/unrun tests.
- [ ] A01–A26 system acceptance and C01–C14 independent-connection races pass.
- [ ] End-to-end reference arithmetic independently reconciles ledgers/caches/reports.
- [ ] Fresh/populated migration, repeat seed, 54 baseline regressions plus current
  head-specific tests and metadata comparisons pass.
- [ ] Confirmed counts, payment evidence, terminal refunds, old revisions and source
  provenance remain protected under direct SQL and API tests.
- [ ] Direct/Nginx/cross-origin API headers and published runtime contract match.
- [ ] Sandbox/payment/refund recovery, SMTP configuration and external schema head
  verified in the intended deployment; exact operational limits documented.
- [ ] Runtime role grants, backup/restore rehearsal, pending-money recovery and
  release/rollback procedures recorded with representative performance measurements.
- [ ] General/child trackers, agent guidance, README, source/runtime contract and
  frontend operation readiness agree; full product browser gates tracked separately.
