# Whole-backend verification strategy

**Status:** required future verification, not passing runtime evidence.
Each [work package](MODULES.md) adds its domain-specific cases; the source
[operation inventory](OPERATIONS.md) prevents omission of later state branches.

## 1. Test layers and isolation

| Layer | What it proves | Required implementation |
| --- | --- | --- |
| Pure/unit | Decimal, dates, cursors, policy truth tables, deterministic allocation/replay plans | Real helpers with controlled clock/entropy; expected values from independent examples. |
| HTTP/contract | Request/response schema, errors, permissions, media, ETag/key semantics | Actual routes/dependencies; validate against target Draft 2020-12 schemas with format checking. |
| PostgreSQL integration | Queries, constraints, persisted effects, audit, commit/rollback | Apply real current migrations in guarded disposable databases; no SQLite substitute. |
| Concurrency | One-winner/update serialization/conservation under interleaving | Independent committed connections with barriers/events and bounded timeouts. |
| Transport/recovery | SMTP/provider signatures, deadlines, lost reply, restart/reconcile | Actual local TLS/HTTP services plus the selected deployed sandbox gate. |
| Deployment | Runtime composition, direct/Nginx headers, required environment | Built locked images on isolated test ports; no mutation of the populated demo as a test fixture. |

M02 extracts reusable database-factory and source-schema helpers from the auth
harness into shared test support, retaining its guarded legacy auth configuration.
Introduce a clearly documented `DMS_TEST_DATABASE_URL` for business tests with a
disposable naming guard; never fall back to runtime DB_* or silently skip required
integration. Per-module fixtures isolate business data and grants; parallel/race
tests must not share a truncation-based mutable database across suites.

Every mutation test inspects state from a fresh connection after completion. A
mocked commit call is not proof of persistence. Failure injection includes before
flush, mid-ledger, deferred validation and definite commit failure. Unknown commit
outcomes are a separate retry/recovery scenario, not a claimed rollback.

## 2. Per-function and per-operation gates

- Register actual callable symbols and source requirement/case IDs in each owning
  TESTS, including nested dependencies, validators and new helper methods.
- Require meaningful success, failure and boundary cases for every completed symbol.
  Coverage does not substitute for conservation, rollback or race assertions.
- New owned behavioral code has **100% statements and branches per scoped file**;
  no exclusions hiding reachable errors. Include shared code moved out of auth in
  auth regression coverage. Inspect coverage JSON, not a rounded global percentage.
- Every operation is checked for exact method/path/operationId/security, request
  strictness, response variants, status inventory, response headers and empty 204.
- Permission tests include every single grant in anyOf, each missing grant in allOf,
  missing/false registry rows, conditional branches and actual next-request changes.
- Query tests cover combined filters, ties/ascending/descending cursors, limit 1/25/
  100/101, empty results, malformed/stale-scope cursors and unauthorized detail access.
- Required skip/xfail/unrun cases keep the function, operation and module open.
  Store exact command, node/case IDs, environment and relevant persisted results.

## 3. System acceptance scenarios

| ID | Scenario and independently checked result | Owner/gate |
| --- | --- | --- |
| A01 | Login → group/status/password administration → old access/refresh/reset denied; grant-only change reflected next request | M04–M05 + M01 regression |
| A02 | Last district slot admitted once; lower global cap/type limit cannot invalidate current committed state | M08/M10/M12 |
| A03 | Unused product/agency delete succeeds; historical zero-balance owner cannot be deleted; direct cache mutation rejected | M11–M12 migration |
| A04 | Receipt → READY issue → current price changes → post keeps frozen price and updates stock/debt only at post | M15/M17/M19 |
| A05 | Issue gross temporarily exceeds limit but atomic verified upfront net fits; post succeeds with one auto receipt | M19 |
| A06 | Verified money + failed stock post remains VERIFIED; separate full cash into FIFO/excess credit once | M19 |
| A07 | Backdated manual collection changes later FIFO correctly; future invoice/manual overpay rejected with full rollback | M16/M18 |
| A08 | Two 0.5-unit returns of a 1-VND unit yield 1 and 0 VND, both stock movements retained | M23 |
| A09 | Multi-receipt credit → multi-invoice application → return retains original cash provenance; no new cash from application | M16/M23/M25 |
| A10 | Count observes stock; intervening in/out returns same quantity; confirmation still stale; recount then confirm works | M22 |
| A11 | Zero-difference count retains lines, adjustment ID null; nonzero requires extra permission and atomic adjustment | M22 |
| A12 | Online amount valid at initiation, other collection reduces debt, success still records full money and excess credit | M26 |
| A13 | Late signed success after FAILED/EXPIRED accepted once; invalid signature/reference/amount never records money | M26 |
| A14 | Refund UNKNOWN survives process restart with full reserves; reconcile queries same attempt and posts only verified success | M27 |
| A15 | Verified refund failure releases; retry creates new revision/reservation/attempt, never reactivates old evidence | M27 |
| A16 | Correction moves mistaken date/quantity, reverses old checkpoint and replays all later cash/return/credit effects | M29 |
| A17 | Posted issue cancellation preserves received upfront cash separately; insufficient manual FIFO debt blocks cancellation | M29 |
| A18 | Correct/cancel cannot invalidate effective return, reserved credit, paid refund or confirmed count evidence | M29 |
| A19 | Current stock nonnegative but a past checkpoint negative after cancellation: reject and preserve all original state | M29 |
| A20 | Old revision print unchanged after master/contact rename; HTML/PDF and canceled/draft markers correct | M28 |
| A21 | All reports reconcile original corrections, actual return/refund periods, net sales and cash/credit separately | M30 |
| A22 | Export full filter >100 rows and >10^18 aggregate values; correct totals, company ratio denominator and permissions | M30 |
| A23 | Dashboard each single-grant user sees only its allowed fields; current balances distinct from historical-month flows | M31/D09 |
| A24 | Chatbot exact code, duplicate name, >25 candidates, clarification and forbidden read never leak profile/financial data | M32/D10 |
| A25 | Valid purchase price/rate yield >Money-range or rounded-zero quote; all reads/mutation results follow D16, while invalid stored issue prices are rejected before commit | M02/M10/M11/M15/M17/D16 |
| A26 | Backdated new issue/receipt/upfront precedes persisted return/application/refund history; complete replay succeeds or genuine invariants reject atomically, never an unimplemented-kind fallback | M16–M19/M23/M25–M29/D17 |

### End-to-end reference arithmetic

Use a dedicated fixture with stock 100, unit purchase price 100000, rate 1.02,
zero opening debt/credit and sufficient limit. All amounts are exact VND:

1. Sell 10 units (1020000), upfront 300000 → stock 90, debt 720000, credit 0.
2. Manual receipt 400000 → debt 320000.
3. Initiate online 320000; while pending manually receive 200000 → debt 120000.
4. Verified online receives full 320000 → debt 0, credit 200000.
5. Return two units worth 204000 → stock 92, debt 0, credit 404000.
6. Sell two new units on credit (204000) → stock 90, debt 204000.
7. Apply 150000 credit → debt 54000, credit 254000; no new cash receipt.
8. Reserve then pay refund 100000 from one eligible source → debt 54000, credit
   154000, reserves 0. During UNKNOWN, credit stays 254000 and available is 154000.

Independent expected totals: cash received 1220000; cash refunded 100000; gross
sales 1224000; returns 204000; net sales 1020000. Select a source receipt whose
unreserved provenance covers the refund rather than allowing an arbitrary source.
Verify headers/versions/audit plus ledger sums, not only response arithmetic.

## 4. Mandatory race matrix

Run both lock winners where order affects the valid outcome. Use event/barrier
synchronization, not guessed sleep timing. Every test checks final persisted state.

| ID | Competing operations | Required invariant |
| --- | --- | --- |
| C01 | Same scoped command, same/different payload | One committed effect; matching recovery or 409 conflict; no duplicate audit/receipt. |
| C02 | Two ETag edits; line edit vs header/submit | At most one stale-token mutation; coherent parent detail and total. |
| C03 | Group assignment/delete; grant create/create; user change/refresh | FK/grants/session invariants maintained; no stale authorization after committed invalidation. |
| C04 | Agency create/move vs cap/rule/district change | No capacity oversubscription or ineligible active admission. |
| C05 | Issue post vs lower limit/type/terminate/master change | Final current limit, eligibility and agreed snapshot preserved. |
| C06 | Two issues or negative adjustments using same stock | No current/historical negative stock; all products follow ordered locking. |
| C07 | Two collections or backdated collection vs issue/correction | Date-valid FIFO and per-invoice nonnegative history. |
| C08 | Upfront post vs separate/replace/cancel | Evidence resolves to exactly one cash recording; no lost VERIFIED money. |
| C09 | Count confirm/recount vs stock movement | Snapshot identity respected, no adjustment from obsolete observation. |
| C10 | Two partial returns / return vs corrected origin | Quantity and cumulative rounded amount never exceed valid sale. |
| C11 | Credit apply vs refund reserve / two refunds | Available credit and source receipt cap consumed once. |
| C12 | Payment webhook vs reconcile / duplicate events | One full receipt and excess lot set; terminal success never regresses. |
| C13 | Refund confirm/reconcile vs cancel/retry | UNKNOWN stays reserved; one payout; no retry until definite failure. |
| C14 | Correction vs later receipt/return/application/refund | Stable dependency closure or transaction restart; all effects reconcile after winner. |

Include multi-product opposing order tests and bounded deadlock/serialization
retries. A timeout is not proof of correctness; assert recovery and final balances.

## 5. Migration, evidence and performance gates

- Fresh head, populated prior-head upgrade, repeat upgrade, safe downgrade/re-upgrade.
  Check domain/infra manifests, constraints/generated fields and no spurious
  autogenerate drops on SQL-managed objects.
- Full seed twice with unchanged demo passwords/document history; preserve the
  baseline 54 regression checks and run additional head-specific migrations/tests.
- Direct SQL adversarial attempts against all new guards; privileged bootstrap
  and restricted runtime-role behavior verified separately.
- HTTP/JSON errors, captured logs, audit, retry and transport metadata contain no
  credential sentinels, raw signing keys, reset URLs or provider authentication.
- Profile representative reads and historical writes with EXPLAIN (ANALYZE, BUFFERS)
  and recorded dataset/connection counts. Suggested measurement fixture: 100000
  documents plus linked ledger history, separate from the 410-document smoke seed.
  Measure P50/P95, query count and lock-wait times for list/post/replay/export.
  Set a deployment-specific budget after measurements; no unsupported SLA claim.
- Test bounded memory and cleanup for full exports, Vietnamese glyph rendering,
  cancellation/error paths and large exact values. No silent result truncation.
- Test runtime-route publication against the delivery manifest, complete state/kind
  branches and populated dependency coverage. A route hidden only from OpenAPI is
  still callable and does not satisfy an unpublished-operation gate.
- Rehearse deployment upgrade/rollback procedure and database restore in an isolated
  target-like environment; preserve pending payment/refund reconciliation on restart.

## 6. Commands and rollout

Existing backend commands, from `backend/`:

```sh
uv sync --frozen
uv run ruff check .
uv run ruff format --check .
uv run pytest
uv run pytest tests/integration/auth -m integration
```

Existing auth strict coverage and deployment commands remain in
[authentication TESTS](../authentication/TESTS.md). The first `pytest` command is
offline by default; it does not close a PostgreSQL gate.

M02 must add and document shared business test selection and exact coverage paths.
The future full-suite command is `uv run pytest tests/integration -m integration`
after all guarded module harnesses exist; it must fail clearly on missing required
database/transport setup. Each child records concrete scoped coverage commands,
including source modules and per-file branch JSON checks, rather than claiming an
unconfigured generic whole-backend coverage number.

In an explicitly isolated migration/demo environment, from `backend/`:

```sh
uv run alembic upgrade head
uv run alembic current
uv run python -m app.db.seed
uv run python -m app.db.seed
uv run python -m app.db.verify --seeded --regression
```

From repository root for this documentation package:

```sh
python openwiki/backend-design/plan/full_backend/validate_plan.py
git diff --check
```

The read-only validator covers both roadmap graphs/checklists, all operation owners,
transport parameter/body metadata, execution packets, baseline source declarations
and references. Its Decimal witness confirms the D16 arithmetic/schema mismatch;
it does not simulate a migrated database or prove a future price-policy repair.

Compose quiet validation/build/smoke belongs to implementation/deployment changes.
UI type/lint/build/browser checks belong to frontend changes. Full backend release
requires real API integration; full product release additionally requires the
frontend checklist's live browser workflows. Neither is implied by this plan.
