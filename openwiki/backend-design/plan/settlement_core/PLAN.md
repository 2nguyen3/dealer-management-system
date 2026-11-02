# M16 — Settlement core

Prepared 2026-10-11 before code. **Status: E09/E10 locally verified.**
Prerequisite: locally verified M15 core at source
head0006. Owner: `backend/app/modules/settlement_core/`. No new HTTP operations.

## Scope and phases

1. E09: exact pure FIFO allocation and ordered cash-provenance pairing; typed
   financial event/leg/lot projections; historical balance/available-credit queries.
2. E09: caller-owned receipt posting and refund reservation/release/consumption.
   Automatic receipts target only their issue; manual collection forbids surplus;
   separated/online receipts preserve full cash and create excess credit.
3. E10: deterministic chronological financial replay, append-only reversals and
   replacement allocations, preservation of refund sources/reservations, persisted
   kind capability register separate from HTTP availability.
4. Verify every actual symbol with success/failure/boundary behavior, isolated PG
   persisted-state/rollback and opposing races; record exact coverage and evidence.

Reuse document_core, auth callbacks, exact numeric helpers and reviewed SQL. Helpers
never commit/rollback or update balance caches. The owning request runs a durable
command, supplies live authorization/audit context, forces deferred constraints,
and commits once all stock, cash and evidence legs are complete.

## Boundaries

Financial replay reads frozen totals for existing returns; M23 owns return-line
rounding/new revisions. M29 owns posted correction/cancel orchestration and changes
to original document content. M17–M19/M25–M27 own new domain writers/provider proof.
Supporting financial effects of existing kinds does not publish their HTTP APIs.
All public operation availability remains58/154 +2 health until owning writers pass.

Local gate: **617 non-deployment cases (247 offline +370 PG/TLS), exact100%**
combined scope; M16 adds28 offline +25 PG cases,474 statements/208 branches.
Next: expand M17 stock_issues before E11. Direct/Nginx20-case evidence is retained
from M15, not rerun in this internal-only module task.

Read [REQUIREMENTS](REQUIREMENTS.md), [DESIGN](DESIGN.md), [TESTS](TESTS.md),
[CHECKLIST](CHECKLIST.md), [VERIFICATION](VERIFICATION.md) and the full-backend
[M16 work package](../full_backend/MODULES.md#m16--settlement_core).
