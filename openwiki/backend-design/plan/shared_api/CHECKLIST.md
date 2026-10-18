# M02 implementation checklist

**Status:** locally verified 2026-10-03. See actual symbols in [TESTS](TESTS.md)
and exact passing [VERIFICATION](VERIFICATION.md). M03 is the next owning slice.

- [x] 2026-10-04 relocation to `app.common` and shared exception ownership verified;
  actual-symbol register/current coverage commands aligned and full regression
  gates passed. See [refactor evidence](../../../../backend/REFACTOR_VERIFICATION.md).

## Phases

- [x] P0 — Baseline/harness/source contract confirmed in isolated environment.
- [x] P1 — Exact values, errors and audit context pass required tests.
- [x] P2 — Pagination/cursors/ETag/preconditions pass required tests.
- [x] P3 — Durable commands/migration/transaction protocol and races pass.
- [x] P4 — Body/media/limiter/CORS and seed/verifier integration pass.
- [x] P5 — Full required tests/coverage/auth regression/evidence/docs pass.

## Function gates

Replace each proposed responsibility with actual symbols/test nodes on implementation.

- [x] SA01 — Exact numeric/ID schema parsers and formatters.
- [x] SA02 — Calendar/instant/range/timezone helpers.
- [x] SA03 — Safe shared error handlers/projections.
- [x] SA04 — Operation-aware database error translation.
- [x] SA05 — Business audit context and request-ID integration.
- [x] SA06 — Sort registry/keyset/page queries.
- [x] SA07 — Signed scope-bound cursor codec.
- [x] SA08 — Canonical strong aggregate ETag.
- [x] SA09 — Required/exclusive/stale preconditions.
- [x] SA10 — Command mapping and reviewed migration.
- [x] SA11 — Durable claim/find/complete repository.
- [x] SA12 — Canonical payload fingerprint.
- [x] SA13 — Internal substep keys and authorized replay.
- [x] SA14 — Transaction finalization/retry/recovery.
- [x] SA15 — Operation-aware body/CORS/factory integration.
- [x] SA16 — Shared limiter interface and retained auth rules.
- [x] SA17 — Compatible-head seed and explicit table manifest.
- [x] SA18 — Guarded reusable test/configuration helpers.

## Completion

- [x] Register/test every additional actual helper/validator/dependency/route.
- [x] I01–I08 passed against real persisted state and independent connections.
- [x] Fresh/populated migration, seed repeatability and baseline+head tests passed.
- [x] 100% per-file scoped statements/branches and existing auth regression passed.
- [x] No required skipped/xfailed/unrun tests; exact evidence in VERIFICATION.
- [x] Settings/examples/README/AGENTS and general plan/checklist updated to actual
  implementation; M03 next, business operations not pre-claimed.
