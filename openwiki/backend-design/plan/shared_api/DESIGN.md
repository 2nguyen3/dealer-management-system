# M02 design

## 1. Implemented symbols and file ownership

| Area | Proposed location/responsibility |
| --- | --- |
| Exact values | `app/common/values.py`: strict parsers/formatters and Decimal context; schema annotations in `app/common/schemas.py`. |
| Dates | `app/common/dates.py`: parse date/aware instant, validate ranges, Vietnam date derivation. |
| Errors | `app/core/exceptions.py`: application errors; `app/common/responses.py`: safe HTTP projections; preserve AuthError compatibility. |
| Context | Extend `app/core/request_context.py`: explicit validated function_code, generated request ID; auth uses users.manage default. |
| Pagination | `app/common/pagination.py`: SortSpec, CursorCodec, keyset query helpers and source pagination response. |
| Preconditions | `app/common/preconditions.py`: canonical detail token, header validation, compare-after-lock helpers. |
| Commands | `app/common/commands.py`: ApiCommand, CommandScope/Result, CommandRepository, fingerprint and internal substep UUIDs. |
| Transactions | `app/core/transactions.py`: caller-owned runner/finalization and bounded definite transaction retries. |
| Test support | `tests/support/` and shared fixtures: source schema refs, guarded database factory, clocks/barriers and probe app. |

Final callables are registered in TESTS §4 with passing evidence in VERIFICATION.
Common numeric aliases accept strict strings from JSON and validated native Decimal
values for database/domain response hydration. CatalogId is strict integer in JSON;
CatalogParameter handles lexical path/query integers before enforcing the same range.

## 2. Exact values, errors and context

Validate lexical source patterns before Decimal/int conversion. Reject JSON
numbers for numeric strings; accept only real integers for CatalogId (not bool).
Explicitly check ranges beyond the Id regex. Use Decimal precision large enough
for multiplication and dynamically sized aggregate operations, then apply HALF_UP
only to derived amounts, never to invalid external precision.
Test derived quote overflow/rounded zero separately from request validity (D16).
Shared serializers must support an eventual dedicated derived-quote schema without
weakening stored Money/PositiveMoney or converting through floats.

Pydantic aliases expose the correct JSON string/integer schema and preserve response
camelCase. Safe validation projections contain field pointers and reviewed code/
message, not pydantic input/ctx dumps. Admin passwords later inherit auth's secret
handling even outside `/auth/`. Keep error translation operation-aware because the
same database SQLSTATE can represent several business conflicts.

Extend audit context with a keyword function_code defaulting to users.manage;
validate against existing FUNCTION_CODES. Bind actor/request/function to set_config
with local=true. A SYSTEM actor clears actor state explicitly. Never accept client
actor/function values. Middleware must attach requestId on safe unexpected errors
as well as success and validation responses.

## 3. Cursor and ETag protocol

CursorCodec uses versioned base64url canonical payload plus HMAC, purpose-separated
from access JWTs. It derives its key from the configured AUTH_SIGNING_KEY using
`agentra:cursor:v1`; no additional secret setting is needed. Rotating that master
key invalidates outstanding cursors. Cursors never serve as authentication tokens.

Payload: operation/resource scope, canonical filter/sort/allowed-kind digest,
ordered typed last values and codec version. Decode length/structure/types before
building query predicates; all failures map to INVALID_CURSOR. Sort field names
come from static operation registries, not interpolation of client text.

Strong ETag hashes canonical detail data with a representation-version prefix.
Caller supplies the complete aggregate projection and resource identity. Probe
tests include child-only edits and joined fields, not only flat timestamp rows.
Resource mutation locks/reloads and invokes comparison in its own transaction.

`read_preconditions` reads all header occurrences and rejects duplicates before
calling the pure parser. Route authors must use this request-aware adapter rather
than a scalar Header binding, which can discard repeated fields.
Precondition parsing explicitly detects missing headers before normal required-field
validation. Reject weak tags, wildcard If-Match, multiple tokens and simultaneous
If-Match/If-None-Match according to the single-token source contract. Permission
upsert uses exclusive-create semantics under a group/pair lock plus unique constraint.

## 4. Durable command persistence

Revision 0004 adds `dms.api_idempotency` including:

- UUID PK; actorId FK to app_user; operationId/resourceScope/clientKey tuple unique.
- Fixed-length request digest of canonical business payload, format version.
- Local completion or externally accepted state, domain reference/recovery metadata.
- Reviewed safe result/status/ETag/Location; never raw request/credentials/errors.
- Required createdAt/updatedAt with explicitly installed timestamp trigger.

Command scope is built from the matched operation ID and validated actual resource
IDs, not user-entered arbitrary scope. Anonymous auth commands and webhooks are
excluded. A duplicate insert uses conflict-safe SQL/reselect rather than leaving
the request session in an aborted transaction. Same key/different digest conflicts;
completed match returns saved result after current authorization. Fresh command
validates preconditions and executes inside the same transaction as completion.

Derive internal UUIDs from persisted command ID plus named substep to satisfy
global creationKey/idempotencyKey columns without cross-actor collisions. Keep
separate internal keys for each generated auto receipt and posting/replay batch.

Local failure rolls back unfinished record and effects. Concurrent matching calls
wait/reload; bounded lock contention can use the operation's documented 409 path.
Ambiguous commit retry looks up the same key. Financial identities are not purged
by a generic short expiry. Provider modules extend accepted records with a durable
domain/recovery reference; M02 tests this seam but does not invent provider success.

## 5. Transaction integration and schema compatibility

Session may already have an active transaction from authentication reads. The
runner takes commit ownership of that unit, not a nested independent transaction.
`work(command)` returns a no-write projection callback. No repository/primitives
commit. Flush → force deferred constraints → materialize/validate and normalize
JSON-safe result → complete command → commit → HTTP success. On definite
exception rollback before translating; bounded full retries only for known
serialization/deadlock conditions. Unknown commit is a recovery case.

The authorize callback rechecks current identity/grants on every attempt/replay;
each owning use case specifies its target lock order and conditional checks. The
local runner does not call providers. ACCEPTED/recovery records are the persistence
seam for later M26/M27 orchestration, not evidence of a provider workflow. No local
runner path commits CLAIMED state; out-of-band incomplete records fail closed.

Vietnam business dates use explicit UTC+07, valid for supported business history,
so Windows/container behavior does not depend on optional zoneinfo installation.
Timestamp lexical validation rejects invalid offset hours/minutes before parsing.

Migration code must preserve original snapshots and explicitly include command
table timestamps/grants. Update seed's literal head requirement to an explicit
current-compatible-head check and verifier's exact domain/infra manifest. Seeded
mode may legitimately have zero infrastructure rows. Baseline 54-check reconstruction
of 0001 stays labelled baseline; head-specific migration tests cover this change.

## 6. Wiring and operational settings

- Keep one generated request ID path and one exception translation mechanism;
  avoid competing auth/business middleware that both consume the body.
- Apply JSON Content-Type validation by operation body metadata, not every POST.
  Reserve a raw-body signature verification boundary for M26 before JSON parsing.
- Add business header allow/expose configuration; no credentials-enabled CORS change.
- Reuse the bounded limiter through a general interface with explicit business
  operation/actor/peer scopes and documented configurable limits. Preserve auth's
  stricter paths and missing-account behavior. One worker remains the deployment gate.
- Document new settings only when implemented; signing keys stay blank in examples.
  Runtime never installs schema or calls providers at startup.
