# Full backend requirements and current-state assessment

**Inspection date:** 2026-10-02. Paths and behavior refer to the working tree,
including the pre-existing uncommitted authentication implementation.

## 1. Source authority

| Source | Authority |
| --- | --- |
| [BA](../../../BA/DMS_exploration.md) | Original BM1–BM16/QĐ requirements and proposed extended workflows. Its legacy 17-table section is historical. |
| [Selected decisions](../../../database-design/business_decision_making.md) | Confirmed Q01–Q15 decisions and separately labelled implementation conventions supersede conflicting early BA suggestions. |
| [Database README](../../../database-design/README.md), [DBML](../../../database-design/DMS.dbml) | Workflow interpretation, model explanation and diagram. |
| [0001 DDL](../../../../backend/alembic/sql/0001_initial.sql), [0002](../../../../backend/alembic/sql/0002_search_indexes.sql), [0003](../../../../backend/alembic/sql/0003_auth_sessions.sql) | Executable current schema. New revisions repair mismatches; deployed snapshots remain immutable. |
| [Target OpenAPI](../../API/openapi.json) | HTTP operation IDs, schemas, methods, paths, headers, permissions and errors. It is a target, not a deployed-route inventory. |
| [Application factory](../../../../backend/app/main.py), [auth](../../../../backend/app/modules/auth/service.py), tests and configuration | Actual implementation. |
| [Frontend roadmap](../../../frontend-design/GENERAL_PLAN.md) | Consumer integration and browser completion requirements. |

When target API, selected business behavior and executable SQL disagree, log the
specific conflict in [DECISIONS](DECISIONS.md), reproduce it and fix the owning
contract/migration. Neither a trigger nor an old BA paragraph silently changes
the user-facing contract. API examples are fixtures, not universal business state.

## 2. Implemented versus planned

**Current checkpoint 2026-10-05:** M01–M14 and M15 core verified;58/154 target+2
health published. [Availability](AVAILABILITY.md) and owning child plans are the
current authority. The table/counts below retain the **initial 2026-10-02 planning
baseline**; their future labels are historical. M16–M32/M28–M29 gates remain open.

| Area | Observed implementation | Remaining work |
| --- | --- | --- |
| API process | Factory/lifespan, injected settings, CORS, request IDs, health and readiness | Business-wide error/media/precondition/rate-limit behavior; business router registration. |
| Auth/access | Seven auth operations; Argon2id, JWT, digest-only refresh/reset, live session/version/grants, TLS SMTP seam | Administrative endpoints; operational SMTP/reset-page configuration and explicit external 0003 deployment. |
| ORM | `UserGroup`, `AppFunction`, `AppUser`, `GroupPermission`, `AuthToken` | Remaining 24 domain tables as needed; read-only SQL views need not become ORM entities. |
| Database | 29 tables, three numeric domains, five views, report/guard functions, three revisions | Durable HTTP retry infrastructure and narrowly reviewed gap repairs; services that construct valid business transactions. |
| Seed/verification | 410 documents, 30 agencies, 24 products, eight demo users; 54 baseline SQL checks | Update exact-head/exact-table assumptions for additive infrastructure; API fixtures/races/replay evidence. |
| Tests | Auth/config/health offline, isolated PostgreSQL/TLS and explicit direct/Nginx smoke | Reusable business harness, all business contract/state/concurrency suites, exports and sandbox transport. |
| UI | React 19/strict TS/Vite/plain CSS; native fetch health check with abort/timeout | No router, auth UI, business screens, runtime API schema client, component/browser test runner. |
| Deployment | API + Nginx + explicit migration service, external DB, locked images | Full business smoke, runtime grants, provider/reset operational setup, release/restore/reconciliation runbook. |

Actual HTTP routes are two health operations plus seven auth operations. The
target contract has **154 unique operations**, seven implemented auth operations
and **147 future business operations**. `getAgencyBalance` carries two tags but
is one operation. M02, M13, M16 and M29 include shared/internal work and therefore
cannot be measured by adding API tag counts.

[Existing auth evidence](../authentication/VERIFICATION.md) reports 122 offline,
58 PostgreSQL/TLS and four deployment tests, with 100% scoped statements/branches.
This planning session inspected that evidence and source; it does not claim to
have rerun those tests or inspected the current external database.

### Important baseline details

- `AuthService.transaction` commits/rolls back; reusable repositories and
  `invalidate_user_sessions` leave commit to the caller.
- `get_session` supplies one synchronous request session. Auth reads can already
  have started its transaction before the business service runs.
- `set_audit_context` currently always sets `users.manage`.
- Non-auth errors currently fall back to FastAPI defaults; auth middleware's
  credential-safe media/error behavior is path-specific.
- CORS currently permits Authorization/Content-Type/X-Request-Id; business headers
  and export headers are missing from its allow/expose configuration.
- `seed.main` requires the literal head `0003`. `check_database` requires the exact
  29-table set and 58 timestamps. `run_regression` reconstructs 0001, not current head.
- `protect_balance` rejects every cache DELETE, including for unused owners.
- The supplied SANDBOX checkout URL is an example; seed `DEMO_SANDBOX` events make
  no provider calls. HTTPX is currently a development dependency.
- `inventory_overview` computes an unconstrained derived selling price while the
  API uses bounded Money for that quote; valid inputs can exceed its response range
  (D16). This must be settled before the affected price consumers are published.
- Later financial kinds are already persisted by the seed. Early replay handlers
  and full-operation labels require an additional mixed-history release gate (D17).
- No repository CI pipeline or payment recovery runner currently exists. Their
  ownership and incremental evidence belong to the [execution sequence](EXECUTION.md).

## 3. Business traceability

| Requirement | Owning slices | Required observable behavior |
| --- | --- | --- |
| BM1/QĐ1, BM4 | M07, M08, M10, M12, M20 | Active district capacity, duplicate names, immutable code, zero opening balances, permanent termination, continued collection. |
| BM2/QĐ2 | M09, M11, M13–M15, M29 | Draft-neutral receipt; positive exact quantities/prices; post stock; newest-business-date source price; historical cancellation guard. |
| BM3/QĐ3 | M13, M16–M19, M29 | READY price freeze, current stock/limit recheck, confirmed upfront money, atomic issue/automatic receipt, preserved real money. |
| BM5/QĐ5 | M16, M18–M20, M26 | Manual collection within allocatable debt at business date; invoice FIFO; online/separated cash records full received amount. |
| BM6.1/BM6.2/QĐ6 | M20, M24, M30–M31 | Correct original-period reversals; return-period net; cash/return/credit decreases distinct; company-gross denominator. |
| QĐ7 | M07–M11 | Record-based catalogues; singleton cap/rate; current debt/capacity blocks invalid lowering; snapshots preserved. |
| BM8/QĐ8 | M08, M12 | Inactive types unavailable for new assignment; all referenced agencies block deletion, including terminated. |
| BM9/QĐ9 | M09, M11, M13–M15 | Active masters, integer-unit policy, no client-written price/stock, no unit-meaning change after recorded use. |
| BM10/QĐ10 | M13, M16, M19, M23, M29 | Reasons, immutable old versions, complete atomic replay, no physical document deletion, no fake erasure of received/refunded money. |
| BM11/QĐ11 | M01, M04 | Case-insensitive email, hash-only password, locked-account denial, same-transaction session invalidation. |
| BM12/QĐ12 | M03 | Four seeded groups; group with ACTIVE or LOCKED users cannot be deleted. |
| BM13/QĐ13 | M01, M05, every route | Data-driven current grants, explicit allOf/anyOf/conditional rules, no MANAGEMENT bypass or employee-dealer ownership inference. |
| BM14/QĐ14 | M02, M06, every writer | Transaction-local actor/function/request; immutable, redacted audit; rollback leaves no committed audit. |
| BM15/QĐ15 | M16, M26–M27 | Signed sandbox evidence, one receipt per success, verified late success, no browser-authorized money, safe refund recovery. |
| BM16/QĐ16 | M32 | Read whitelist; exact scoped permission; code/name/district disambiguation without aggregate name matching. |
| Extended inventory/counts | M21–M22 | Signed stock-only adjustments, book + last-entry snapshot, recount after movement, retain zero-difference evidence. |
| Extended returns/credit/refunds | M16, M23–M27 | Source-linked returns, cumulative rounding, separate credit, reserve-before-refund, no double consumption. |

### Confirmed decisions Q01–Q15

| Decision | Binding implementation rule | Verification owner |
| --- | --- | --- |
| Q01 | Draft/confirmation workflows with allocations and counts | M13, M16, M22 |
| Q02 | Verify upfront first; issue and auto receipt commit together | M19 |
| Q03 | New immutable revision under original document identity | M13, M29 |
| Q04 | Correct erroneous original business period | M29, M30 |
| Q05 | Nonnegative affected history, not just today's totals | M14–M29 |
| Q06 | Invoice FIFO; linked auto receipt is an exception | M16, M18 |
| Q07 | Replay valid downstream allocations while retaining actual cash | M16, M29 |
| Q08 | Actual returns and actual refunds are supported | M23, M27 |
| Q09 | Actual return/refund date, distinct from correcting a mistake | M23, M27, M30 |
| Q10 | Credit can be explicitly applied or refunded, once | M24–M27 |
| Q11 | Online success records all money; excess becomes credit; no debt reservation | M26 |
| Q12 | Reject lower limits/type changes below current debt | M08, M12 |
| Q13 | Latest business-date receipt determines current purchase price | M15, M29 |
| Q14 | Selling price freezes at READY, not warehouse post | M17, M19 |
| Q15 | Whole VND, three quantity decimals, six rate decimals, HALF_UP | M02, M13, M23 |

## 4. Frontend-facing requirements

1. Keep `/api/v1`, camelCase, source operation IDs and exact response variants.
   Document mutation results are not interchangeable with document details.
2. BIGINT IDs are decimal strings; small `CatalogId` values are integers. Money,
   quantity and rates remain strings; aggregate report values have wider bounds.
3. Calendar business dates remain DATE strings; event instants use explicit UTC
   offsets and business-date derivation uses Asia/Ho_Chi_Minh.
4. Expose ETag/Location/Content-Disposition and allow If-Match/If-None-Match/
   Idempotency-Key in cross-origin requests. Line responses return the parent token.
5. Source `Error` includes safe field pointers/details/requestId; preserve 204 empty
   bodies and distinct 401/403/409/412/428/429 outcomes for recovery.
6. Keep current grant discovery in `/auth/me`; domain actions enforce conditional
   permissions after reading state. UI button visibility is not authorization.
7. Provide operation-level readiness and source-derived examples per slice. Mocked
   UI and liveness do not mean a business operation is available.
8. Return committed authoritative balances; an uncertain provider call returns the
   persisted payment/attempt, not fabricated success. Reconciliation resumes it.
9. Print selected historical snapshots; exports cover the full filter, not a page.

## 5. Scope boundaries already selected by the project

The chosen scope excludes suppliers/payables, multiple warehouses/branches,
multi-currency, taxes, full double-entry accounting, product categories,
lot/serial tracking, inferred dealer ownership and required chatbot history.
These exclusions come from the existing business decisions; this plan does not
add them back as prerequisites to completing the specified backend.
