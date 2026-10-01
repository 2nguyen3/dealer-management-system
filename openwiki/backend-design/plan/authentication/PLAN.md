# Authentication module — implementation plan

**Status:** planned; no authentication code or new migrations implemented by this document.
**Prepared:** 2026-10-01. **Module:** `authentication`. **Owner:** backend.

This is M01 in the backend [General Plan](../../GENERAL_PLAN.md). Authentication
uses the existing seeded identity/RBAC data; account/group/permission administration
endpoints follow it and are not prerequisites for implementing login.

## 1. Goal and reading order

Implement the seven `Authentication` operations in the backend API contract,
using existing DMS employee accounts, Argon2id passwords, PostgreSQL token storage,
and live group-based permissions. Every completed function must have passing,
meaningful tests and recorded evidence before its checklist item is closed.

Read these materials together:

1. [REQUIREMENTS.md](REQUIREMENTS.md): source traceability, scope, and contract details.
2. [DESIGN.md](DESIGN.md): implementation decisions, schema delta, transactions, configuration.
3. [TESTS.md](TESTS.md): per-function tests, integration/concurrency cases, and commands.
4. [CHECKLIST.md](CHECKLIST.md): ordered implementation gates, initially unchecked.
5. [VERIFICATION.md](VERIFICATION.md): evidence template and current verification status.

The API source is [API/openapi.json](../../API/openapi.json), not the current
runtime OpenAPI, which only exposes health infrastructure. Database authority is
[0001_initial.sql](../../../../backend/alembic/sql/0001_initial.sql) plus subsequent
reviewed revisions. Source conflicts and implementation decisions are explicit
in REQUIREMENTS and DESIGN; this plan does not claim that proposed choices were
previously approved BA requirements.

## 2. Deliverables and boundary

Deliver login, refresh rotation, session logout, current account/permissions,
self-service password change, reset-email requests, and single-use reset completion.
Also deliver reusable authentication/permission dependencies, safe auth errors,
request IDs, throttling, an SMTP delivery adapter, a session/version migration,
and automated unit, HTTP-contract, PostgreSQL, and concurrency tests.

Authentication uses `dms.app_user`; it is not Supabase Auth. Each employee has one
group. Permissions are function-level; there is no inferred dealer ownership.
Existing health endpoints remain public and retain their current payloads.

Account creation/update/admin reset (`/users`), group CRUD, permission-management
CRUD, audit browsing, business APIs, and frontend login/reset screens are separate
modules. Their required invalidation behavior is covered here through direct
database integration fixtures and a reusable invalidation service. An SMTP reset
link can be tested with a local mail sink/API client before the frontend exists.

## 3. Proposed implementation layout

Paths below are **future files**, unless listed under existing integration points.

```text
backend/
  app/
    api/
      auth.py                  # Seven thin HTTP handlers
      schemas/auth.py          # Strict requests and explicit safe responses
      errors.py                # Auth error/validation translation
      dependencies/auth.py     # Bearer principal and allOf/anyOf permissions
    auth/
      models.py                # Five identity/access ORM mappings
      repository.py            # Bound queries, token persistence, row locks
      service.py               # Auth transactions and credential workflows
      passwords.py             # Argon2id hash/verification
      tokens.py                # Opaque-token digest and JWT codec
      delivery.py              # Reset link composition and SMTP adapter
      rate_limit.py            # Single-process bounded limiter
    core/request_context.py    # Request-ID middleware and audit context
  alembic/
    versions/0003_auth_sessions.py
    sql/0003_auth_sessions.sql  # New reviewed additive snapshot
  tests/
    auth/                      # Unit and HTTP tests; no external DB/mail
    integration/auth/          # Real isolated PostgreSQL, including races
```

Create package `__init__.py` files as necessary; no business logic in them.
Existing integration points: `app/main.py`, `app/api/router.py`, `app/core/config.py`,
`app/db/base.py`, `app/db/session.py`, `alembic/env.py`, `app/db/seed.py`,
`pyproject.toml`, `uv.lock`, and backend/root setup docs. Keep synchronous services
and `get_session`; use synchronous route functions for DB, Argon2, and SMTP work.

## 4. Implementation sequence and exit gates

Do not implement a whole phase and defer its tests. Within each phase, implement
one function/behavior, write its failure and success assertions, run its focused
tests, then record evidence. Test-first is recommended for security and transaction
invariants. Reuse collaborators instead of fragmenting code just to increase the
function count. The function register in TESTS must track actual symbols.

| Phase | Work and dependencies | Required exit evidence |
| --- | --- | --- |
| P0 — Contract and harness | Read sources, freeze seven-operation scope, add proposed test/dependency tooling, markers, clock/mail/repository fixtures, offline auth settings. | Contract inputs resolved; existing tests still pass; harness tests prove live tests cannot use the demo DB accidentally. |
| P1 — Session schema and mappings | Add revision after current head; reviewed token session/version delta; register ORM mappings; adapt seed for new columns and accepted revision. | Fresh upgrade and upgrade of populated `0002` database pass in disposable PostgreSQL; constraints, backfill, ORM names and seed repeatability tested. |
| P2 — Credentials and tokens | Settings validation, Argon2id helpers, opaque generation/digest, JWT encode/decode and response projection. | All primitive functions pass success, malformed, boundary and secret-redaction tests; real Argon2 and JWT library exercised. |
| P3 — Session services | Repository locking, login, refresh, logout, live principal lookup and invalidation. | PostgreSQL lifecycle tests and refresh/refresh, refresh/logout, refresh/invalidation races pass; rollback failure tests pass. |
| P4 — Authentication HTTP and RBAC | Login/refresh/logout/me routes, safe error handlers, request IDs, rate limits, permission dependencies. | Four operations conform to source schemas/statuses; permission truth tables and next-request permission updates pass. |
| P5 — Password workflows | Password change, reset requests, reset completion, SMTP adapter and compensating token revocation. | Remaining three operations pass; reset replay/races, locked-account and mail-failure behavior pass; local SMTP capture test passes. |
| P6 — Release verification | Full contract/error/header suite, all scoped-function coverage, migration compatibility, docs/config and smoke checks. | Full commands in TESTS pass; every function has evidence; source/runtime contract comparison and isolated lifecycle smoke pass. |

Dependency graph: `P0 -> P1 -> P2 -> P3 -> P4 -> P5 -> P6`.
P2 pure-helper work can proceed while a disposable PostgreSQL environment is
prepared, but P1/P3 are not complete until real database tests run.

## 5. Strict completion policy

A function is complete only when all of the following hold:

- Actual symbol and source requirement are in the test register.
- Tests exercise actual behavior, including failure/boundary paths and side effects;
  a test merely asserting a mock was called is insufficient.
- Mutating functions have persisted-state and rollback assertions. Database
  functions have real PostgreSQL coverage; concurrency claims have multi-connection tests.
- Tests pass without a skip/xfail substituting for the required cases.
- Evidence records command, result, case IDs, and implementation revision/diff.
- Secrets never appear in HTTP errors, captured logs, audit, or persisted raw-token fields.

Target **100% statement and branch coverage for auth-owned behavioral code**,
including auth schemas/dependencies/errors and request context, with no exclusions
to hide reachable failures. Coverage is an additional gate, not proof of correctness.
Integration points changed in existing files require dedicated regression cases.
Any helper/class method/nested function introduced later must be added to the
register with its own assertions before it can be marked complete.

## 6. Release acceptance

1. An ACTIVE seeded-compatible user logs in by case-insensitive email, gets only
   documented response fields, and sees live group permissions.
2. Wrong credentials yield 401; valid credentials for LOCKED users yield 403.
3. Refresh tokens are single-use, purpose/version checked, and rotated atomically.
4. Logout invalidates only the identified session, including its access tokens;
   unknown/already logged-out refresh tokens still return empty 204.
5. Password change/reset invalidates all old sessions. Group/status changes and
   direct SQL changes cannot resurrect old refresh or access tokens.
6. Reset requests conceal account existence/status; valid reset tokens work once;
   resetting never unlocks a LOCKED account or automatically logs the user in.
7. RBAC denies missing/false/unknown permissions and supports source `allOf`/`anyOf`.
8. No passwords, hashes, JWTs, refresh/reset tokens, or credential-bearing links leak.
9. Required concurrency, migration, mail, error-contract, and failure-path tests pass.
10. Setup docs describe new settings and actual implemented behavior; deployment
    topology limitations and any external-provider smoke not run are recorded.

## 7. Implementation prerequisites

- Disposable PostgreSQL with permission to create a dedicated test database/schema;
  baseline unit/HTTP tests must remain independent of Supabase.
- Backend-only signing secret and SMTP configuration supplied outside Git.
- Local SMTP sink for deterministic delivery verification; deployment mail service
  credentials are an operational input, not committed example values.
- Single API process for the initial limiter. Multiple workers/replicas require
  replacing its store with a shared atomic store and running equivalent tests.
- Frontend reset-page URL chosen through backend configuration; the frontend page
  itself is a later frontend deliverable.

These prerequisites block the corresponding release gates, not preparation of this plan.
