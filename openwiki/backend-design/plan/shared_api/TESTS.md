# M02 strict tests

**Status:** implemented and locally verified 2026-10-03; 36 M02 offline and 26 real
PostgreSQL cases. Exact commands and combined auth/shared coverage are in VERIFICATION.
Use [whole-system tests](../full_backend/TESTS.md) and the source OpenAPI.

## 1. Proposed function/responsibility register

`U` unit, `H` real HTTP/probe, `D` real PostgreSQL, `C` independent connections.
Replace proposed symbol families with all actual callable definitions before closure.

| ID | Proposed symbols/responsibility | Success, failure and boundary assertions | Layer |
| --- | --- | --- | --- |
| SA01 | Exact numeric parsers/formatters and schema aliases | Canonical round trips; JSON number/bool/exponent/nonfinite/leading-zero rejection; bounds ±10^18/10^15, precision3/6, huge aggregates and Id max; integer CatalogId; derived-price overflow/rounded zero distinct from valid input (D16). | U/H |
| SA02 | Date/instant/range helpers | Leap date/aware UTC/Vietnam midnight; impossible date/naive instant; equal/reversed/one-sided half-open ranges and timezone data availability. | U/H |
| SA03 | ApiError/validation/http/unexpected handlers | Exact Error/FieldError/pointers/requestId; malformed400/media415/semantic422; internal safe500, empty204; credential sentinels absent even on /users. | U/H |
| SA04 | Constraint/domain translation | Known unique/FK/domain/guard maps in operation context; unknown safe500; rollback precedes query; SQL messages/parameters never escape. | U/H/D |
| SA05 | set_audit_context/request-ID integration | Correct business function/USER/SYSTEM; auth default retained; unknown code rejected; bound values, rollback and connection/request isolation. | H/D |
| SA06 | SortSpec/keyset predicates/page builder | Source defaults/whitelist, all tie directions, empty/last page and limit1/25/100; invalid101/0; SQL injection text bound, literal %/_ searches. | U/H/D |
| SA07 | CursorCodec encode/decode/scope | Roundtrip each typed key; tamper/truncate/wrong-version/operation/parent/filter/sort/allowed-kinds; removed grants rechecked; empty/boundary page. | U/H |
| SA08 | canonical_etag/detail projection | Stable canonical representation; different resource/child/equal-total edit/joined balance changes token; no secrets in token/input projection; no timestamp collision assumption. | U/H/D |
| SA09 | precondition parsing/comparison | Correct tag/update/create; missing428, stale412+ETag, invalid weak/wildcard/list/both headers; two clients serialize compare under lock. | U/H/D/C |
| SA10 | Command ORM/migration upgrade/downgrade | Fresh/populated head, unique scope/digest/timestamps/FK, unchanged business/auth data, safe downgrade/re-upgrade and zero infra rows. | D |
| SA11 | CommandRepository claim/find/complete | Commit recovery, unfinished definite rollback, conflict-safe insert/reselect; payload mismatch409; actor/operation/resource isolation; repositories never commit. | D/C |
| SA12 | canonical_request_fingerprint | Key order/default normalization, omitted-vs-null and ordered line arrays; changed amount/source differs; no raw credentials/request stored. | U/D |
| SA13 | internal_substep_key/result replay | Same command/step stable, different actor/resource/step distinct; stale original If-Match replay works; revoked grants/conditional permission denied; no second audit/effect. | U/H/D/C |
| SA14 | TransactionRunner/finalize/retry | Flush/deferred check/result validation/commit order; definite mid-write/deferred/commit rollback; bounded 40P01/40001 retries; unknown commit resolves by key, no blind new intent. | H/D/C |
| SA15 | Operation-aware body/CORS/factory wiring | JSON-required versus empty POST; preserve raw webhook body seam; all allow/expose headers; auth/health/docs unaffected; no startup DDL/provider call. | H |
| SA16 | General limiter key/policy interface | Threshold N/N+1, Retry-After≥1, window boundary, clock/thread/capacity; no credential key leakage or forwarded-header spoof; preserved auth behavior. | U/H |
| SA17 | Seed/head/table-manifest compatibility | New compatible head seeded twice; unchanged counts/passwords/history; exact unknown/missing table errors; 54 baseline checks labelled separately; infra allowed empty. | D |
| SA18 | Shared test/configuration helpers | Explicit business/auth URL guards and no runtime fallback; missing selected integration fails; source refs/format checks reject invalid fixtures; isolated connection cleanup. | U/D |

## 2. High-value integrated cases

- I01: test-only flat resource plus child mutation with real DB/ETag; two original
  tokens compete and only one mutation wins. Parent representation includes child.
- I02: two requests same command/payload: one business mutation and audit event;
  both recover committed result. Different payload yields conflict without new effect.
- I03: same client UUID in different actor/operation/resource scopes works independently;
  internal domain keys remain unique for a composed parent + generated child.
- I04: failure after tentative ledger insert/deferred check rolls back domain,
  audit and command record; retry same key succeeds once after failure removed.
- I05: simulate committed result with lost HTTP reply/new app instance; same key
  finds prior result before stale version comparison; fresh key fails stale version.
- I06: completed result exists but grant removed/account locked: replay is denied.
- I07: source-required headers/status/body models through actual middleware; bodyless
  actions need no JSON header; required If-Match missing returns 428.
- I08: migrate populated 0003, seed twice at new head in separate fixture, preserve
  original demo and token rules; run baseline regression plus new head checks.

## 3. Coverage, commands and closure

Require 100% statements/branches per newly owned behavioral file and all required
cases. Include moved auth behavior in its existing coverage scope; do not reduce
the auth gate when extracting errors/context. No required skip/xfail completion.

Existing commands, from backend/:

```sh
uv sync --frozen
uv run ruff check .
uv run ruff format --check .
uv run pytest
uv run pytest tests/integration/auth -m integration
```

Test locations: `tests/shared_api/` and `tests/integration/shared_api/`.
Record exact `uv run pytest tests/shared_api` and
`uv run pytest tests/integration/shared_api -m integration` runs plus combined
coverage over the final shared/schema/errors/context/transaction files. Inspect
per-file JSON for zero missing statements/branches; commands cannot be claimed
passing before paths, guards and test prerequisites exist.

Use auth's current exact coverage commands for regression, adapting moved-code
targets explicitly. Run the whole-backend planning validator and git diff --check
when updating status/evidence. Only then close SA entries and P0–P5.

## 4. Actual-symbol register (2026-10-03)

Paths below are relative to backend/ and use `app.common` for
values/dates/pagination/canonical/preconditions/commands/
transport/rate_limit/schemas. Exception constructors belong to `app.core.exceptions`;
the error projection helpers belong to `app.common.responses`.
Tests include valid behavior, rejected inputs
or collaborator failures, and relevant boundaries; the table groups callables by
their original SA responsibility. Dataclass/Pydantic generated methods have no
additional custom behavioral definitions. Test-only probe closures are exercised
by their owning HTTP/integration scenarios.

| SA | Actual callables | Passing nodes/files |
| --- | --- | --- |
| SA01 | `values.parse_number`, `format_number`, `validate_number`, `validate_id`, `parse_catalog_parameter`, `rounded_amount`, `validate_fraction`; `schemas.numeric_alias` | `test_values.test_exact_numeric_contracts` (13 domains), `test_ids_text_and_output_failures`, `test_exact_arithmetic_and_fraction_policy`; `test_http.test_bodyless_raw_and_preconditions` native Decimal/catalog transports |
| SA02 | `dates.parse_date`, `parse_instant`, `validate_range`, `vietnam_date` | `test_values.test_calendar_instants_and_ranges` leap/offset/Vietnam midnight/one-sided/empty/reversed ranges |
| SA03 | `core.exceptions.ApiError.__init__`; `responses.business_path`, `api_error_response`, `api_error_handler`, `field_pointer`, existing `http_error_handler`, `validation_error_handler`; `request_context.request_context` | `test_http.test_business_errors_are_safe`, `test_business_exception_and_browser_headers`, `test_middleware_owned_business_error`; retained auth error/privacy tests |
| SA04 | `transactions.translate_database_error` | `test_protocols.test_transaction_error_translation`; integration `test_commands.test_operation_constraint_translation_after_rollback` unique/FK/check plus unknown deferred failures |
| SA05 | `request_context.set_audit_context` | `test_foundations.test_audit_context_and_parent_child_etag`; auth `test_permissions_audit`; four injected rollback scenarios |
| SA06 | `pagination.SortSpec.parse`, `ordering`, `after`, `literal_search`, `build_page` | `test_protocols.test_page_sort_and_search`; integration `test_foundations.test_real_keyset_ties_and_literal_search` both directions/name/id ties |
| SA07 | `pagination.cursor_error`, `decode_key`, `CursorCodec.__init__`, `encode`, `decode` | `test_protocols.test_cursor_scope_tamper_and_typed_keys` signed invalid versions/shapes/types/filter/kind/parent scopes, all typed keys, size bounds |
| SA08 | `canonical.canonical_value`, `canonical_json`; `preconditions.canonical_etag` | `test_values.test_canonical_exact_and_rejections`; `test_protocols.test_etags_and_preconditions`; integration child-only edit and stale-update race |
| SA09 | `preconditions.Preconditions.compare`, `parse_preconditions`, `read_preconditions` | `test_protocols.test_etags_and_preconditions`, `test_duplicate_header_and_create_transport`; HTTP 428/412/duplicate header and PG one-winner |
| SA10 | `0004_api_commands.upgrade`, `downgrade`; ApiCommand mapping | `test_foundations.test_populated_upgrade_repeat_seed_manifest_and_downgrade`, `test_command_constraints_and_downgrade_blocker`; retained auth metadata comparison |
| SA11 | `commands.CommandScope.__post_init__`, `CommandRepository.__init__`, `find`, `claim`, `complete` | `test_commands` persisted/restart/rollback/accepted/immutable/scope/concurrent cases; `test_protocols.test_missing_command_and_retry_budget` defensive disappeared-row boundary |
| SA12 | `commands.request_fingerprint` | `test_protocols.test_command_identity_and_safe_results`; scope/payload mismatch PG cases |
| SA13 | `commands.internal_substep_key`, `CommandResult.checked`, `validate_safe_result` | `test_protocols.test_command_identity_and_safe_results`, `test_command_result_is_json_safe_before_commit`; PG cross-actor composed keys, stale replay/current grant denial |
| SA14 | `transactions.TransactionRunner.__init__`, `run` | `test_commands` four rollback points and deferred refresh projection; `test_foundations` actual SERIALIZABLE/deadlock races and lost commit reply; retry-budget exhaustion |
| SA15 | `transport.BusinessRoute.get_route_handler`, nested `transport`, `matched_operation`; factory CORS wiring | `test_http` modeled/bodyless/raw/preparsed rejection tests; two `test_shared_api_smoke` direct/Nginx cases |
| SA16 | `common.rate_limit.check_business_limit`; retained `modules.auth.rate_limit` | `test_http.test_business_limiter_and_operation_match`; retained clock/window/thread/capacity/auth spoof cases |
| SA17 | existing `seed.main`, `verify.check_database`, `run_regression`, `verify.main`; manifest constants | auth repeat seed and shared populated 0003→0004/repeat seed/manifest/timestamp/baseline54 cases; built-container verifier |
| SA18 | `tests.support.database.guarded_test_url`, `migrate`, `database_factory`, nested `create`; `contract.resolve`, `assert_schema`, `transport_matrix` | both guarded suites, explicit missing-URL setup failure, 154-operation source matrix, invalid RFC3339 fixtures/checker missing boundary, all isolated PG tests |

Combined strict coverage scope after the module-layout refactor: `app.modules`,
`app.common`, `app.core`, `app.api`, `app.db.base` and `tests.support`;
see [commands/evidence](../../../../backend/REFACTOR_VERIFICATION.md).
The historical M02 checkpoint was 30 files, 1259 statements and 328 branches,
zero missing/excluded statements/branches per file. Existing seed/verifier changes
and revision functions are additionally tested by real migration/seed/CLI cases;
this is not a whole-backend coverage claim.
