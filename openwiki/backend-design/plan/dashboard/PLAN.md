# M31 Dashboard Plan

Prepared2026-10-28. Completed/published2026-10-29 under the user's implementation request.
Six production files,291owning offline cases,14unique actualPG and3direct/proxy/public
dashboard cases pass. Final full offline1084pass; dashboard161statements/24branches and
aggregator68/0 exact per-file100%. Runtime153business+2health at0009; only chatbot absent.
M29/M30 prerequisites are complete with owning evidence. Whole R6 remains separate.
D09's admission/projection interpretation preserves canonical security policy.

## Scope And Authority

Own exactly `getDashboard`, `GET /dashboard` under the existing `/api/v1` prefix.
The [canonical OpenAPI](../../API/openapi.json) remains the sole HTTP contract.
Deliver monthly authorized sections, current balances/queues, period flows,
monthly sales chart and bounded top lists. No exports, writes, provider calls,
new permissions, migrations, dependencies or background jobs are planned.

Read [REQUIREMENTS](REQUIREMENTS.md), [DESIGN](DESIGN.md), [TESTS](TESTS.md),
[CHECKLIST](CHECKLIST.md) and [VERIFICATION](VERIFICATION.md) together.
Program sources: [General Plan](../../GENERAL_PLAN.md),
[full plan](../full_backend/PLAN.md), [M31 work package](../full_backend/MODULES.md),
[D09](../full_backend/DECISIONS.md), [execution](../full_backend/EXECUTION.md),
[snapshot design](../full_backend/DESIGN.md) and [active goal](../full_backend/GOAL.md).
Operational restrictions in [HANDOFF](../../HANDOFF.md) remain binding.

M30 is the direct prerequisite; M29 correction/replay evidence is inherited.
Their completion is not inferred from this plan. This task neither changes their
files nor closes their gates. Current checkpoint statements are documentary
context, not a fresh inspection of runtime or Supabase.

## D09 Selected Interpretation

Canonical route admission is any of `agency.read`, `inventory.read`, `sales.read`,
`debt.read`, `stock.issue.post`, `cash.upfront.verify`. Schema section readers also
include `stock.issue.prepare` and `cash.receipt.post`. They are not admission grants.

The selected source-consistent behavior uses two independent gates: preserve that
exact admission set, then project each section by its documented reader set.
Prepare-only and receipt-post-only callers receive 403; an admitted caller holding
either grant can receive its corresponding section. No MANAGEMENT bypass, implicit
grant, `reports.read` requirement or union-admission fallback is permitted.

The coordinator selects this conservative source-alignment interpretation under the
user's implementation request. D09's ambiguity is resolved by distinguishing route
admission from conditional section eligibility, not by changing security policy or
claiming user approval of such a change. The earlier union-admission proposal is
not selected; removing section-reader alternatives is also not selected.

No security-policy change is selected. Lack of approval for a security-changing
alternative does not block completing existing canonical semantics. M29/M30 are
complete; required M31 actual test/publication gates now pass in VERIFICATION.
Any source-description/UI clarification must explain the two
gates without expanding or removing permission rules.

## Delivery Sequence

1. Confirm current M29/M30 evidence and register reusable read projections by actual
   symbol. Carry the selected D09 distinction into implementation and consumer wording
   without changing canonical grant sets.
2. Implement exact response schemas and month/window logic in the owning feature;
   register every actual function/validator/dependency before claiming completion.
3. Compose fresh authorization and only authorized queries in a single coherent
   read snapshot. Reuse M30 projections, never report HTTP handlers.
4. Verify independent ledger reconciliation, current-versus-period semantics,
   concurrent receipt/correction consistency and all grant combinations.
5. Meet per-file statement/branch coverage and retained regression gates, then verify
   direct/proxy behavior using only existing services. Update program availability
   and consumer handoff only when the complete operation can be published.

The latest user request authorizes these implementation and publication steps.
Snapshot, authorization and financial gates are jointly
required; service coverage alone cannot establish HTTP/deployment completion.

## Exit Criteria

One source-conformant operation implementing the selected D09 interpretation;
M30/M29 prerequisite evidence; exact schemas; omitted forbidden keys; one coherent `asOf`; reconciled
corrected periods and current values; no unreceipted-money double count; deterministic
12-point/10-item bounds; actual-symbol success/failure/boundary register; real-PG
snapshot races; exact affected per-file coverage; existing-service deployment and
frontend-ready operation handoff. Every unrun or blocked gate stays open.
