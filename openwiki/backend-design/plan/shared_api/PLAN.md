# M02 — Shared API implementation plan

**Prepared:** 2026-10-02. **Verified:** 2026-10-03. **Status:** M02 implemented;
P0–P5 passed locally. See [VERIFICATION](VERIFICATION.md).
**Prerequisite:** verified M01 authentication baseline.

Read [REQUIREMENTS](REQUIREMENTS.md), [DESIGN](DESIGN.md), [TESTS](TESTS.md),
[CHECKLIST](CHECKLIST.md) and [VERIFICATION](VERIFICATION.md) before code. Context:
[full backend plan](../full_backend/PLAN.md) and [General Plan](../../GENERAL_PLAN.md).

## 1. Scope

Provide the common business API behavior that the existing auth-only infrastructure
does not yet implement: exact values, safe errors, audit function context, cursors/
sorts, strong preconditions, durable actor-scoped retry identity, operation-aware
body handling, CORS headers and reusable real-PostgreSQL/contract tests.

M02 owns no new business operation ID. Use test-only probe routes to prove shared
HTTP behavior, then M03 validates the first real resource integration. Document,
count, payment and refund modules supply their own aggregates/domain effects.

## 2. Ordered phases

| Phase | Deliverable | Gate |
| --- | --- | --- |
| P0 | Reconfirm auth/source head, shared test isolation and source schema resolver | Existing auth/offline checks, guard missing integration setup, explicit scope. |
| P1 | Strict numeric/ID/date/text aliases, safe business Error and audit context | SA01–SA05; exact source schema and no credential echo. |
| P2 | Sort registry, cursor codec, canonical strong ETag and preconditions | SA06–SA09; ties, filter scope, 428/412 and child-projection cases. |
| P3 | Reviewed durable-command migration/repository/protocol and transaction runner | SA10–SA14; persisted same-key/payload/scope/race/rollback/recovery cases. |
| P4 | Operation-aware media/limiter/CORS wiring and head-compatible seed/verifier | SA15–SA18; bodyless actions, headers, retained baseline 54 checks. |
| P5 | Complete scope coverage, auth regression and documentation evidence | All required offline/integration cases, exact 100% scoped coverage, aligned trackers. |

Do not run migrations against the external demo to establish test fixtures. Choose
the next revision from actual head at implementation time; 0003 is today's source
head, not a permanent hard-coded assumption.

## 3. Completed implementation and next task

P0–P5 are implemented in `backend/app/common/`, common schemas, business transport,
safe errors/context and the caller-owned transaction runner. Revision 0004 adds the
durable command table; seed/verifier use a reviewed compatible head and explicit
domain/infrastructure manifests. Shared contract and guarded PostgreSQL test support
are reused by authentication. Next: expand and implement M03 user_groups.

## 4. Completion

Close M02 only when every actual owned callable is registered/tested, new schema
upgrades/seeds preserve existing data, real races and recovery pass, auth regression
coverage remains valid and all exact commands/results are recorded. Helpers alone
do not imply any of M03–M32's business routes are available.
