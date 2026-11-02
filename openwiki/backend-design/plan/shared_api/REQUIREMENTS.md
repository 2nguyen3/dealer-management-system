# M02 requirements and traceability

Single HTTP source: [OpenAPI](../../API/openapi.json). Existing behavior:
[exceptions](../../../../backend/app/core/exceptions.py) and
[HTTP error projections](../../../../backend/app/common/responses.py),
[request context](../../../../backend/app/core/request_context.py),
[factory](../../../../backend/app/main.py). Whole-system design:
[shared foundations](../full_backend/DESIGN.md).

| ID | Source | Required behavior |
| --- | --- | --- |
| R01 | Id/CatalogId/numeric schemas; Q15 | Exact strict domains and unbounded aggregates, no float/bool coercion or implicit rounding; preserve catalog integers. |
| R02 | date/date-time parameters; DB time convention | Real calendar validation, aware instants, Vietnam business date, half-open range validation. |
| R03 | Error/FieldError/responses | Safe source error shape; 400/415/422 distinction, exact empty 204, no input/SQL/credential exposure. |
| R04 | QĐ14/SQL audit_change | Validated actor/request/function context in same transaction, SYSTEM clearing, rollback isolation; preserve auth default. |
| R05 | Cursor/Limit/*Sort | Source sort whitelist, stable tie-breaker, default25/max100, signed cursor bound to resource/filter/sort/permission scope. |
| R06 | IfMatch/OptionalIfMatch/IfNoneMatch/ETag | Strong opaque aggregate token, 428 missing, 412 stale with token; wildcard If-Match forbidden; grant create/update exclusive headers. |
| R07 | IdempotencyKey and operation 409 responses | Durable actor/operation/resource scope, fingerprint mismatch conflict, completed replay before stale-version check, current authorization required. |
| R08 | Database write protocol | One caller commit, no helper commit, deferred constraints before refreshed result, no success before commit, definite rollback vs unknown outcome. |
| R09 | Existing creationKey/batch/payment keys | Distinct stable internal substep keys prevent collisions across actors/operations and composed writes. |
| R10 | Browser API integration | Allow precondition/key headers, expose ETag/Location/export filename, preserve no-store auth and request/retry/auth headers. |
| R11 | Source requestBody/security | JSON only where body is required; empty actions work without content type; raw-byte signature seam for webhook. |
| R12 | 429 responses/current limiter | Reusable operation/actor/peer policy and safe Retry-After; preserve existing auth limits and explicit one-worker restriction. |
| R13 | Reviewed migrations/seed/verifier | Additive infrastructure, exact known table manifests, compatible head handling, unchanged demo history, explicit new timestamps. |
| R14 | Strict project verification | Shared guarded PG harness, contract refs/format checks, per-symbol success/failure/boundary/coverage and exact evidence. |

### Contract details to preserve

- Id is decimal string up to signed BIGINT max; CatalogId is integer 1..2147483647.
- Stored money abs<10^18, quantities abs<10^15 and ≤3 decimals, price rate >0/<1000
  with ≤6 decimals. Respect each schema's positive/signed/zero variants separately.
- Aggregate schemas are not storage-domain aliases. Negative net sales are valid.
- Nonempty text does not establish a new arbitrary business maximum. Search trims;
  password does not. PATCH tracks explicit fields and only source-nullable clears.
- Idempotency keys are required only where listed. Missing/invalid key is request
  validation; missing If-Match is the special 428 precondition rule.
- Precondition conflicts are not automatically retried as new mutations. Completed
  matching intent replay is different from a fresh mutation with a stale ETag.
- Existing health payloads and auth privacy/session behavior remain regression gates.

### Decisions owned here

Resolve engineering D01/D03/D04/D05/D11/D12/D14 from the
[gap register](../full_backend/DECISIONS.md). Dashboard and chatbot contract
decisions are later module gates, not prerequisites to these foundations.
For D16, prove the distinction between exact derived arithmetic and bounded stored
Money now; the affected price-response contract decision is due before M10/M11
publication. Do not silently widen every Money schema to fix one derived field.
