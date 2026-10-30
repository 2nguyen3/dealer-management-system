# Agentra backend

## Current Source Review - 2026-10-30

1088offline tests pass; reports/dashboard/API/responses have exact717statements/
140branches coverage. Review fixes isolate test artifacts, reject invalid JWTs before
database allocation and preserve exact sales-rate rounding. Actual-PG boundary and
fresh PDF geometry tests pass. Supabase0009/live30tableintegrity retains411documents/
30agencies/24products. Docker Engine and local API endpoints are unavailable today;
no rebuild/deployment was performed. Older dated publication/image/health evidence
below is historical. [Commands and limits](../openwiki/backend-design/plan/full_backend/VERIFICATION.md).

## Current M31 publication - 2026-10-29

getDashboard published153/154business+2health at source/image/configured0009;
chatbot alone absent. Full1084offline incl291dashboard,14uniquePG and3dashboard+
8retained deployed cases pass;161/24module+68/0API exact100%. [Evidence](../openwiki/backend-design/plan/dashboard/VERIFICATION.md).
All240source hashes match image; live411documents/30agencies/24products and
receipt774/payment37/event retained. Docker/ngrokhealthy, frontendunchanged. Next M32
AI API per user, with provider details/D10 still required; wholeR5/R6/release open.
GET /api/v1/dashboard?month=YYYY-MM preserves canonical six-grant route admission
then independent section projection inside one freshly authenticated read-only
snapshot. Prepare-only/receipt-post-only403; admitted mixed callers may receive those
scalars. Forbidden keys are omitted. Current counters/balances/queue differ from
Vietnam-month flows; asOf relates one response, not future requests. JSON only,
private,no-store, standard requestIDs/rate limit and no reports.read inheritance.

## Current M29-M30 publication - 2026-10-29

All twelve owning correction/cancel and all five report operations are published:
152/154canonical business operations+2health, source/image/configured Supabase0009.
Final1083offlinepass (191reports),11unique owningM30PG across serial resumes plus
normal-appHTTP/resource rerun and11unique direct/proxy/public endpoint cases pass.
Reports438/98, aggregator66/0, sharedresponses48/18 exact per-file100%; M29 disjoint
22file1124/196 evidence separately retained. PDF rendered-output inspection is
automated text/geometry/raster/glyph verification, not a human visual-review claim.
Live411documents/30agencies/24products and payment37/receipt774/10200VND/oneevent
preserved; existingDocker/ngrokhealthy and frontendnotrebuilt. [Exact evidence](../openwiki/backend-design/plan/reports/VERIFICATION.md).
Next M31 dashboard then M32 chatbot; whole R5/R6 acceptance, terminal bank refund and
finalrelease/browser gates remain open. Earlier entries below are historical.

### Published reports

GET `/api/v1/reports/{sales,debt,inventory,product-sales,cash-and-credit}` requires
fromDate/toDate, interpreted as[fromDate,toDate). All formats require reports.read
AND the respective sales.read/debt.read/inventory.read grant. JSON uses canonical
cursor/limit/sort; Accept selects application/json, XLSX MIME or application/pdf.
Binary exports ignore page controls and include every business-filtered logical row
in stable ID order. Exact decimals/IDs remain strings; current credit at generatedAt
is distinct from historical period closing credit. Exports have safe attachment,
no-store/nosniff/Vary/request-ID/CORS headers and finish before any200response.
One response uses one statement snapshot; separate JSON page requests do not freeze
the dataset. Materialization/rendering uses O(full-result) memory with no hidden cap.

## Native VNPAY and M26–M28 publication — 2026-10-25

M26 online payments, M27 refunds and M28 document history/printing are now mounted:
135/154 canonical operations plus2health. Native VNPAY2.1.0 uses separate GET
`/api/v1/integrations/vnpay/ipn` and `/return` transports; the canonical JSON/HMAC
webhook remains for configured normalized providers. These two transport endpoints
are documented here and excluded from canonical business Swagger accounting.

Native signing, exact VND conversion, original-date checkout recovery, querydr/refund
response verification and source-bound refund reconciliation are implemented. IPN
alone or an independently verified query can record cash; browser Return is readonly.
An actual10200VND sandbox payment37 received automatic IPN and created one receipt774
and one event. This authorized development business record increases live documents
410→411; original seeded documents are retained. A separate isolated acceptance refund
of5000VND is confirmed PENDING by VNPAY request/query; no external paid-refund claim.

All27 published packet operation branches retain owning coverage and PostgreSQL
evidence. See the current owning VERIFICATION files for exact scopes and open release
gates; M29 posted corrections/cancellation and M30–M32 remain unavailable. The earlier
engineering checkpoints below are chronological history, not current publication.

## Active M25–M28 engineering checkpoint

M25 credit applications list/detail/create/draft-update/post are mounted; drafts are
neutral, posting applies historical unreserved credit/FIFO debt atomically and
`cashReceived` is always `"0"`. Internal draft cancellation is not a public complete
cancel operation; posted correction/cancellation remains M29. Evidence:
`../openwiki/backend-design/plan/credit_applications/VERIFICATION.md`.

At the historical isolated checkpoint, M26 online payments, M27 refunds and M28 document history/printing were implemented
in the isolated verification composition and **not mounted in the normal API** while
their provider/prerequisite publication gates remain open. HTTPX and ReportLab are
locked runtime dependencies; the Vietnamese-capable Noto Sans font and OFL license
are bundled under `app/modules/document_history/fonts/`. Optional provider settings
must be supplied together: PAYMENT_PROVIDER,
PAYMENT_BASE_URL, PAYMENT_CALLBACK_URL, PAYMENT_CREDENTIAL and PAYMENT_WEBHOOK_KEYS
(JSON key-ID/secret map); timeout/expiry defaults are in `.env.example`. No default
provider credentials are supplied. The accepted external sandbox is not ready (D07);
controlled test transport is not accepted deployed-provider verification. The base
URL must implement the documented normalized sandbox protocol or its explicitly
accepted native translation; naming a provider alone does not add native integration.
Source, isolated schemas and configured staging remain at Alembic `0007`.

FastAPI, Pydantic Settings, SQLAlchemy 2, psycopg 3, and Alembic. Python 3.12
and [uv](https://docs.astral.sh/uv/) are required for local development.

## Local development

Run from `backend/`:

```sh
uv sync --frozen
```

Copy `.env.example` to `.env`, then fill in `DB_PASSWORD` and verify `DB_HOST`,
`DB_PORT`, `DB_NAME`, and `DB_USER` using Supabase's **Connect** panel. Set
`AUTH_SIGNING_KEY` to a backend-only cryptographically random secret with at least
32 UTF-8 bytes. Start the server:

```sh
uv run alembic upgrade head
uv run python -m app.db.seed
uv run uvicorn app.main:create_app --factory --reload --no-proxy-headers
```

- Swagger UI: http://localhost:8000/api/docs
- Liveness: http://localhost:8000/api/v1/health
- Database readiness: http://localhost:8000/api/v1/health/ready

Liveness does not open a database connection. Readiness executes `SELECT 1`
and returns 503 if Postgres is unavailable.

## Supabase connection

Configure the database with separate environment variables:

- `DB_HOST`: Supabase pooler hostname.
- `DB_PORT`: PostgreSQL port, default `5432`.
- `DB_NAME`: Database name, default `postgres`.
- `DB_USER`: Supabase database username, including the project suffix for the pooler.
- `DB_PASSWORD`: Required raw password; do not URL-encode it. Use single quotes in `.env`.
- `DB_SSLMODE`: SSL mode, default `require`.

The example contains this project's session-pooler host and username but no password.
The **session pooler** on port 5432 supports IPv4 hosts. Settings build a SQLAlchemy
URL object internally, preserving reserved characters in the password. Empty
passwords are rejected. `DATABASE_URL` and `MIGRATION_DATABASE_URL` are no longer used.

The application disables psycopg prepared statements and uses `NullPool` so
Supabase handles connection pooling. A transaction-pooler runtime URL is also
supported. Alembic uses the same `DB_*` settings; run migrations with a direct or
session-pooler host and port. If runtime uses transaction pooling, override those
settings for the migration process. The direct endpoint may require IPv6.

This is a server-side Postgres connection. Supabase API keys are not needed.
Keep database credentials on the backend. Authentication and reusable group-based
authorization are implemented; business routes must attach their source permission
policy. Connecting with the database's `postgres` role does not enforce end-user RLS.

## Docker runtime storage and readiness

The root `compose.yaml` runs backend and frontend continuously; `migrate` remains an
explicit one-off `tools` profile. Backend and migration CLI share the bind mount
`../data/backend/` (repository-root `data/backend/`) at `/app/data`. Compose sets
standard Python `TMPDIR=/app/data`; runtime files survive container recreation.
The full root `data/` tree is Git-ignored. Business records are stored on Supabase.

Compose runs exactly one Uvicorn worker with forwarded-header trust disabled. Its
health probe checks writable storage and JSON `{"status":"ok"}` from database
readiness every 30 seconds, with a 10-second timeout, 30-second startup grace period
and three retries.
Startup probing uses five-second intervals. Frontend waits for backend health and
also checks proxied readiness. Docker stdout/stderr logs rotate at 10 MB/three files.

The image creates `/app/data` owned by its non-root app user. On Linux, the host bind
directory also needs the runtime user's ownership (currently `999:999`); see the root
README for setup. Docker Desktop on Windows supplies shared-directory write access.
The optional migration service never runs automatically during normal startup.

## ngrok backend tunnel (Windows)

Use ngrok on the Windows host to forward a public HTTPS endpoint directly to the
Compose backend at `http://127.0.0.1:8000`. The backend must already be running and
its `/api/v1/health/ready` endpoint must return `200`.

The ngrok v3 user configuration is `%LOCALAPPDATA%\ngrok\ngrok.yml`; locate and
validate it with `ngrok config check`. Configure the named endpoint as follows,
preserving any existing user credentials or other endpoints:

```yaml
version: "3"

agent:
  web_addr: 127.0.0.1:4040
  inspect_db_size: -1

endpoints:
  - name: dms-backend
    upstream:
      url: http://127.0.0.1:8000
```

Add your authtoken to that user-level file, then start the endpoint in a terminal:

```powershell
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
ngrok config check
ngrok start dms-backend
```

Keep the terminal open; `Ctrl+C` stops the tunnel. The user-level configuration
contains the token and must stay outside this repository. The local agent API at
`http://127.0.0.1:4040/api/tunnels` reports the public URL; request capture is disabled
by `inspect_db_size: -1`. Check `<public-url>/api/v1/health/ready` and
`<public-url>/api/docs` after starting. If ngrok displays its browser warning on a
free endpoint, an API probe can send the `ngrok-skip-browser-warning: true` header.
If `API_PORT` is overridden in Compose, update the upstream port accordingly.

Use the public HTTPS URL plus the provider's required webhook path when completing
payment configuration. A tunnel does not enable the currently unmounted M26/M27
routes: accepted sandbox credentials, native-protocol mapping and publication gates
still apply. Configure all required `PAYMENT_*` fields together; setting only
`PAYMENT_CALLBACK_URL` fails settings validation. The public URL alone is not an
additional browser origin, so direct webhook traffic needs no CORS change.

## VNPAY sandbox preparation

Native VNPAY settings are prepared separately from the controlled `PAYMENT_*`
adapter. Registration: <https://sandbox.vnpayment.vn/devreg/>. Obtain the eight-character
`vnp_TmnCode` and `vnp_HashSecret` from the merchant registration information.

Put all VNPAY settings directly in `backend/.env`, alongside the database and auth
settings. Local Settings reads `.env` from the backend working directory; Compose
loads `backend/.env` for backend/migration services. There is no extra VNPAY env file.
Shell environment overrides dotenv for local Settings; Compose's explicit service
`environment` entries take precedence over its env file. The variable template is
`backend/.env.example`.

```dotenv
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=''
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_API_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_IPN_URL=https://YOUR-NGROK-DOMAIN/api/v1/integrations/vnpay/ipn
VNPAY_RETURN_URL=https://YOUR-NGROK-DOMAIN/api/v1/integrations/vnpay/return
```

| Setting | Meaning / validation |
| --- | --- |
| `VNPAY_TMN_CODE` | Blank while preparing, otherwise exactly eight alphanumeric characters. |
| `VNPAY_HASH_SECRET` | Raw merchant signing secret, stored as `SecretStr`; whitespace-only is invalid. |
| `VNPAY_PAYMENT_URL` | Literal official sandbox checkout endpoint above. |
| `VNPAY_API_URL` | Literal official sandbox query/refund endpoint above. |
| `VNPAY_IPN_URL` | Proposed HTTPS server-to-server IPN endpoint; distinct from Return. |
| `VNPAY_RETURN_URL` | Proposed HTTPS browser return handler; not money-posting evidence. |

URLs cannot contain credentials, whitespace, query strings or fragments. Prepared
URLs with both credentials blank are allowed. Once either credential is supplied,
both credentials and both callback URLs are required. The current preparation is
sandbox-only and does not accept arbitrary or production provider endpoints.

After filling both credentials, rebuild/refresh the backend from the repository root:

```powershell
docker compose up --build -d --wait --wait-timeout 120
```

Keep ngrok running and update both local callback URLs if its public domain changes.
These native handlers and the HMAC-SHA512 adapter are implemented. Register the exact
IPN URL with VNPAY; Return is passed in the signed checkout request. Native request and
query results may remain PENDING while the bank processes a refund; ambiguous or
unsigned outcomes retain reservations and must not be treated as paid or failed.
Setting `PAYMENT_PROVIDER=VNPAY` does not select the native adapter;
the existing `PAYMENT_*` JSON/HMAC settings must not be populated with VNPAY values.
native composition uses the separate `VNPAY_*` credentials when no controlled provider
is selected. Settings validation itself makes no VNPAY call.

Nginx preserves the backend Referrer-Policy for API responses, so native Return keeps
one `no-referrer` policy through the proxy. Other API responses retain the default
`strict-origin-when-cross-origin` fallback.

Official references: [payment/IPN/Return protocol](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html)
and [query/refund protocol](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr&refund.html).

## Authentication

The seven Authentication operations in the target OpenWiki contract are available:

| Method/path (under `/api/v1`) | Behavior |
| --- | --- |
| `POST /auth/login` | Case-insensitive employee email and Argon2id password; access JWT and opaque refresh token. |
| `POST /auth/refresh` | Single-use refresh rotation preserving absolute session expiry. |
| `POST /auth/logout` | Idempotent session-local logout, including access-token invalidation; consumed ancestors identify the same session. |
| `GET /auth/me` | Header bearer required; safe profile and current allowed function codes. |
| `PUT /auth/password` | Requires bearer and current password; invalidates all sessions and reset tokens; re-login required. |
| `POST /auth/password-reset-requests` | Same 202 message for eligible/missing/locked accounts and recipient delivery failures; disabled mail returns account-independent 503. |
| `POST /auth/password-resets` | Single-use reset token; invalidates old credentials/sessions without unlocking or automatic login. |

Accounts use `dms.app_user`, not Supabase Auth. Access JWTs use HS256 with required
issuer/audience/version/session claims and are checked against PostgreSQL on every
protected request. Only SHA-256 digests of opaque refresh/reset tokens are stored.
Logout revokes a lineage; direct SQL password/group/status changes invalidate tokens
through the existing credential-version trigger. Grants are read on each request;
MANAGEMENT has no permission bypass.

Requests have strict fields and nonempty string passwords/tokens. Spaces and Unicode
passwords are preserved. Auth errors/validation are credential-safe, responses use
`Cache-Control: no-store` and generated `X-Request-Id`, and 401s include
`WWW-Authenticate: Bearer`. Malformed JSON, wrong media type and invalid fields return
400, 415 and 422. The health endpoints remain public with their existing payloads.

### Auth settings

All settings are in `.env.example`; signing, database and SMTP passwords remain blank.

| Settings | Defaults / constraints |
| --- | --- |
| `AUTH_SIGNING_KEY` | Required at API startup, at least 32 UTF-8 bytes; not required by DB-only CLIs. |
| `AUTH_ISSUER`, `AUTH_AUDIENCE` | `agentra-api`, `agentra-ui`; nonempty. |
| `AUTH_ACCESS_TTL_SECONDS`, `AUTH_REFRESH_TTL_SECONDS`, `AUTH_RESET_TTL_SECONDS` | 900 / 604800 / 1800; positive; access TTL <= refresh TTL. Refresh rotation never extends the session. |
| `AUTH_RATE_LIMIT`, `AUTH_RATE_WINDOW_SECONDS` | 120 / 60, across all auth operations per peer address. |
| `AUTH_LOGIN_LIMIT`, `AUTH_LOGIN_WINDOW_SECONDS` | 10 / 60, per peer + case-insensitive email digest. |
| `AUTH_RESET_REQUEST_LIMIT`, `AUTH_RESET_REQUEST_WINDOW_SECONDS` | 3 / 900, per peer + case-insensitive email digest. |
| `AUTH_RESET_LIMIT`, `AUTH_RESET_WINDOW_SECONDS` | 10 / 60, reset completion per peer. |
| `AUTH_RATE_LIMIT_MAX_BUCKETS` | 10000; a full live store rejects new buckets rather than evicting protection. |
| `AUTH_MAIL_ENABLED` | false; enable only with host, sender and reset URL configured. |
| `AUTH_RESET_URL` | Absolute HTTP(S) frontend URL without credentials or fragment; use HTTPS publicly. The link adds `#token=...`; the frontend reset page is future work. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | Blank host/sender; port 587; enabled mail requires a valid sender. |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Optional paired credentials. |
| `SMTP_TLS_MODE` | `starttls` or `ssl`; deployment adapter never uses plaintext SMTP. |
| `SMTP_TIMEOUT_SECONDS`, `AUTH_RESET_RESPONSE_FLOOR_SECONDS` | 5 / 6; positive, floor strictly greater than total delivery wait. |

SMTP runs after token issuance commits. The adapter bounds its complete caller wait
and has four delivery slots. Timed-out/unknown outcomes cause compensating token
revocation, even if a worker later delivers mail. Workers are daemon threads with
socket timeouts; reset delivery is not a durable queue. Logs contain safe event
labels only. Response padding reduces timing differences; database contention,
scheduling and process failures can exceed the floor, so perfect timing privacy
under arbitrary load is not claimed.

Run **one API worker/replica** with the in-memory limiter. The Docker command and
documented local command disable forwarded-header trust. Nginx clients share its
peer-address bucket; public `X-Forwarded-For` cannot bypass it. Per-client proxy
addressing requires explicitly restricted trusted-proxy configuration and equivalent
smoke tests. Multiple workers require a shared atomic limiter store.

Future routes use `get_current_principal` / `require_permissions(all_of=..., any_of=...)`
from `app/modules/auth/dependencies.py`; empty/unknown policies are rejected. Future
administration writers lock the user first and call `invalidate_user_sessions` in
their existing write transaction, without an independent commit.

## Structure

```text
app/
  main.py                     # Application factory and resource lifecycle
  api/router.py               # Aggregate feature routers, mounted once at /api/v1
  core/
    config.py                 # Validated environment configuration
    security.py               # Shared Argon2id password hashing/verification
    logging.py                # Application loggers; Uvicorn configures handlers
    exceptions.py             # Transport-independent application exceptions
    request_context.py        # Request IDs and transaction-local audit context
    transactions.py           # Shared transaction/error/retry policy
  db/
    base.py                   # Shared ORM Base, timestamps and metadata scope
    session.py                # Engine and request-scoped synchronous sessions
    seed.py                   # Transactional complete demo dataset
    verify.py                 # Ledger/cache/report checks and SQL regression
    manifest.py               # Expected domain/infrastructure database objects
    sql/                      # Session-local seed builders and regression fixtures
  modules/
    auth/                     # Router, schemas, dependencies, models, repository,
                              # service, JWT/opaque tokens, SMTP and limiter
    user_groups/              # Router, schemas, models, service, repository,
                              # dependencies; service owns commit/rollback
    users/                    # Existing identity plus account/group/status/admin reset
    districts/                # Global capacity, state and all-reference guards
    agency_types/             # Exact maxDebt, counts and current-debt blockers
    units/                    # Recorded fraction policy, state and reference guards
    health/router.py          # Public liveness/readiness endpoints
  common/
    schemas.py                # Shared strict types, errors and pagination models
    responses.py              # Safe HTTP exception handlers and error schema
    pagination.py             # Sort/keyset/signed-cursor helpers
    catalogue.py              # Shared master DTOs/projections/transactions/pagination
    catalogue_http.py         # Fresh authorization, dependency and response helpers
    preconditions.py          # ETag and conditional request helpers
    commands.py               # Durable scoped command mapping and repository
    transport.py              # Business JSON route validation
    rate_limit.py             # Business-operation limiter interface
    canonical.py              # Canonical exact JSON representations
    dates.py                  # Calendar/instant validation
    values.py                 # Exact numeric/ID validation and arithmetic
alembic/                      # Single migration authority: env.py, versions/, sql/
tests/
  auth/                       # Offline authentication/HTTP/adapter tests
  shared_api/                 # Offline shared transport/protocol/value tests
  user_groups/                # Offline strict group DTO tests
  integration/                # Isolated real PostgreSQL/TLS/concurrency suites
  deployment/                 # Direct API and Nginx smoke tests
```

Add features under `app/modules/<feature>/` with `router.py`, `schemas.py`,
`models.py`, `service.py`, `repository.py` and `dependencies.py` as required.
Administration/audit and master-data APIs through M12, M13 document foundations,
M14 inventory, M15 receipt core and M16 internal settlement are implemented.
M17–M20 issue/manual-receipt/upfront/receivable APIs are implemented with owning
verification and deployment evidence. M21–M24 adjustments/counts/returns/credit are
implemented with passing owning gates; M25–M32 and deferred M28/M29
operation gates remain future work. Use focused helper names rather than a
general-purpose `utils.py`. Register feature routers in `app/api/router.py`.

Routes delegate business logic to services. Repositories use the caller's session
and never commit/roll back; services retain transaction ownership. Inject
`get_session` and commit explicitly at the service transaction boundary; closing
a session rolls back uncommitted changes. `alembic/` is the sole migration location;
there is no second migration tree inside `app/db/`. Root `compose.yaml` serves the
whole application. Existing startup, seed and migration commands are unchanged.

## Migrations

The initial database is implemented with reviewed SQL snapshots:

- `0001`: all 29 `dms` tables, domains, sequence, indexes, integrity/audit triggers,
  read models, report functions and core rules/RBAC.
- `0002`: `pg_trgm` substring search indexes, including Supabase extension-schema discovery.
- `0003`: immutable token issuance version/session lineage, historical-token revocation
  and one-current-refresh/session index. Upgrade before serving auth traffic.
- `0004`: durable scoped business commands, timestamp/identity guards and safe
  result/recovery persistence. Head-compatible seed/verifier allow empty infrastructure.
- `0005`: lock unit before document/count quantity validation and freeze any recorded
  fraction meaning, including drafts/counts/canceled history; verified first-use races.
- `0006`: eligible zero-cache owner deletion, product first-use locks and agency
  acceptance/history-date serialization; direct cache mutations remain denied.
- `0007`: current POSTED same-return successor revisions may replenish original
  credit lots, retaining immutable lot/receipt IDs and reserved/paid-refund evidence.
- Alembic tracks the revision in `public.alembic_version`, independently of the
  DDL's transaction-local search path.

```sh
uv run alembic upgrade head
uv run alembic current
```

SQL snapshots belong to their revisions and must not be edited after deployment;
add a new reviewed revision for changes. Initial deployment fails if `dms` already
exists; it does not overwrite a legacy schema. Downgrading `0001` removes the whole
`dms` schema and its data. `0002` downgrade retains the potentially shared extension.

The five identity/access tables have one mapping each in `app/modules/auth/models.py`,
`app/modules/users/models.py` and `app/modules/user_groups/models.py`;
`app/common/commands.py` maps the 0004 command infrastructure; three catalogue
mappings own district/agency_type/unit, including the exact money_vnd domain.
All nine mapped tables have zero inspected autogenerate drift. Future models must use
`app.db.base.Base`, `schema="dms"`, the quoted camelCase SQL names and PostgreSQL
domains, and be imported in `alembic/env.py`. Autogeneration is scoped to mapped
tables to avoid dropping SQL-managed or Supabase-owned objects. Domains, views,
functions and triggers require explicit SQL migrations; they are not inferred
by Alembic. Migrations are explicit, never run on API startup.

From the repository root:

```sh
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm migrate python -m app.db.seed
```

## Demo seed and live database verification

```sh
uv run python -m app.db.seed
uv run python -m app.db.verify --seeded
uv run python -m app.db.verify --seeded --regression
```

The demo populates all 29 tables with 30 agencies, 24 products, 410 documents and
four months of trading history (June–September 2026). It covers multi-line receipts/
issues, current/historical price snapshots, FIFO cash/bank/online collections,
upfront evidence, returns, credit lots/application, cash/online refunds and pending
reservations, stock counts, drafts, cancellations, correction revisions, reversals
and automatic audit logs. Full counts and all 8 demo account credentials are in
the [root README](../README.md#tài-khoản-đăng-nhập-mẫu).

Passwords are hashed with Argon2id. Seeded tokens are random digests, all revoked;
raw tokens are discarded. Provider evidence uses `DEMO_SANDBOX` and explicitly
marked simulated payloads; the seed never calls a real gateway. These app users
are not Supabase Auth users. They can now log in through the backend auth API.

Seed requires the reviewed compatible source head (`0007`) and an empty application
dataset on first run, keeps
core rules/groups/permissions created by the migration, and commits the complete
dataset atomically. An advisory transaction lock serializes seed runs. Re-running
uses a stable document creation key to identify demo v1, verifies the existing
data/password hashes, and does not append duplicates or overwrite data. Trigger
checks are forced at each posting boundary; balance caches are never written
directly. History creation runs in PostgreSQL to avoid hundreds of network trips.

The verifier reconciles documents, ledgers, balance caches, credit reservations,
audit redaction and report totals, with explicit domain/infrastructure manifests
(29 + 1 tables, 60 timestamps). Infrastructure command rows may be empty;
unknown or missing tables are errors. `--regression` creates an isolated temporary
schema from the initial DDL, executes the 54 SQL checks, then rolls back the
schema and every fixture, so demo/business data are not part of the regression.
The regression requires schema-creation privileges, as migrations do.

## Checks

```sh
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

The default suite selects offline tests and does not require a live database.
Real-state tests use only an explicit disposable `AUTH_TEST_DATABASE_URL` with a
database named `agentra_auth_test` or `agentra_auth_test_<suffix>`; the harness creates
and drops isolated databases. It never falls back to runtime `DB_*` credentials.
Explicit integration selection without configuration fails setup.

```powershell
$env:AUTH_TEST_DATABASE_URL='postgresql+psycopg://postgres@127.0.0.1:55432/agentra_auth_test'
uv run pytest tests/integration/auth -m integration
```

See [strict auth test commands](../openwiki/backend-design/plan/authentication/TESTS.md)
for the combined 100% statement/branch gate, TLS sink and deployment smoke selection.
The integration runner generates its local TLS certificates and SMTP sink automatically.

Module-layout refactor verification (2026-10-04): **159 offline tests, 108 isolated
PostgreSQL/TLS tests and 8 direct/Nginx deployment tests passed**, with 100% statements
and branches in the declared module/core/common/API/base/support scope. Fresh and
populated migrations, no-change ORM comparison, repeat seed, rollback/races and all
54 SQL regressions passed. See [refactor evidence](REFACTOR_VERIFICATION.md) and the
[current coverage commands](../.agents/workflows/verify.md).

Historical baseline verification: `uv sync --frozen`, `uv run alembic upgrade head`
and `uv run alembic current` (head `0002`), full seed and a second seed run with
unchanged row counts, `uv run python -m app.db.verify --seeded --regression`
(54 PostgreSQL checks passed), Ruff lint/format and pytest (5 tests passed).
The live database is Supabase PostgreSQL 17.6. Real gateway calls, concurrent
load/performance tests and Docker runtime were not verified in that baseline run.

Authentication verification (2026-10-02): 122 offline tests, 58 isolated PostgreSQL/
TLS integration tests, 100% scoped statements/branches and 4 direct/Nginx deployment
smoke tests. Fresh/populated upgrade, downgrade/re-upgrade, seed twice and all 54 SQL
regressions passed. Exact commands and function evidence are in
[VERIFICATION.md](../openwiki/backend-design/plan/authentication/VERIFICATION.md).
Provider SMTP credentials and external provider delivery have not been exercised.

## Full backend implementation plan

See the [full backend execution package](../openwiki/backend-design/plan/full_backend/PLAN.md)
for the current-state assessment, complete operation inventory, 32 module work
packages, transaction/replay architecture, schema gaps and integration/race gates.
The [execution sequence](../openwiki/backend-design/plan/full_backend/EXECUTION.md)
defines 22 delivery packets, decision checkpoints and operation publication gates
for the existing mixed-history demo and frontend consumers.
The [M02 shared API child plan](../openwiki/backend-design/plan/shared_api/PLAN.md)
and [M03 user groups](../openwiki/backend-design/plan/user_groups/PLAN.md) are implemented
with passing evidence. The active [GOAL](../openwiki/backend-design/plan/full_backend/GOAL.md)
targets all 154 operations; M04 users and M07–M09 catalogues also have passing
owning evidence. M05/M06/M10–M12 and M13/M14/M15 core also pass local gates;
M16 settlement_core passes its internal E09/E10 gate. M17–M20 now add22operations;
owning/deployment gates and all370retained PG/TLS cases pass, alongside308offline.
M21–M24 pass their declared gates; next is M25 credit_applications after its owning
plan. Deferred M28/M29 stays open.

## Shared API foundations and user groups

M02 provides strict exact numeric strings/native Decimal response hydration,
catalogue integer versus BIGINT string IDs, aware dates/instants, safe business
errors, validated audit context, signed scoped cursors, aggregate ETags and required
single-token preconditions. CORS allows If-Match/If-None-Match/Idempotency-Key and
exposes ETag/Location/Content-Disposition. AUTH_SIGNING_KEY derives a separate
cursor signing key; rotation invalidates outstanding cursors.

Revision `0004` installs actor/operation/resource-scoped durable commands. The
local transaction runner forces deferred constraints, validates/normalizes JSON
projections, and persists completion before commit. Same-key retries require current
authorization; uncertain commit is recovered using the same key. Financial identities
are not expired or deleted. ACCEPTED/recovery records are a seam for later provider
modules. Downgrade is blocked while durable commands exist.

The five User Groups operations are published under `/api/v1`:

| Method/path | Policy and behavior |
| --- | --- |
| `GET /user-groups` | Any groups.manage/users.manage/permissions.manage; q/code, six catalogue sorts, signed keyset pages. |
| `GET /user-groups/{groupId}` | Same reads; integer catalogue ID, count includes LOCKED users, complete-detail ETag. |
| `POST /user-groups` | groups.manage; strict code/name, no implicit grants; 201/Location/ETag. |
| `PATCH /user-groups/{groupId}` | groups.manage; nonempty update and required strong If-Match; 428/412 stale guards. |
| `DELETE /user-groups/{groupId}` | groups.manage AND permissions.manage; accounts block deletion; eligible grants/group/audit atomic, empty204. |

Group pagination stores a bounded signed anchor ID, then reloads sort values;
unbounded TEXT fields remain supported. If the anchor was deleted, restart the list
after INVALID_CURSOR. Each page rechecks current permissions. Writes recheck grants
after target lock waits, and never return success before commit.

Business limiter settings `API_RATE_LIMIT=120` and `API_RATE_WINDOW_SECONDS=60`
apply per matched operation/actor/direct peer through the shared interface. The
existing bounded limiter is shared; one worker/replica and no forwarded-header trust
remain the deployment model.

Business integration uses explicit disposable `BUSINESS_TEST_DATABASE_URL`, named
`agentra_business_test` or a suffixed variant, with database create/drop privileges.
No runtime credential fallback is permitted. Current checks/evidence:
[shared](../openwiki/backend-design/plan/shared_api/VERIFICATION.md) and
[groups](../openwiki/backend-design/plan/user_groups/VERIFICATION.md).

## Users and master-data APIs (M04/M07/M08/M09)

All twenty owning operations are published; the current runtime contains 80 target
operations plus two health endpoints. Canonical request/response details remain in
the [single target OpenAPI](../openwiki/backend-design/API/openapi.json).

| Resource under `/api/v1` | Operations and guards |
| --- | --- |
| `/users` and `/users/{userId}` | List/create/detail/patch; users.manage throughout; BIGINT IDs stay strings, group selectors use catalogue integers. Case-insensitive email uniqueness, Argon2id hashes, no password patch/delete. Actual group/status changes invalidate all sessions/reset tokens atomically; profile/no-op updates retain sessions. |
| `/users/{userId}/password-reset` | users.manage, nonempty newPassword and required If-Match; empty204, no automatic login/unlock or password response. |
| `/districts` and `/districts/{districtId}` | Five CRUD operations; read any district.manage/agency.read/agency.manage, write district.manage. Global-rule capacity/current active counts; inactive admission and all-reference deletion protection. |
| `/agency-types` and `/agency-types/{typeId}` | Five CRUD operations; read any agency_type.manage/agency.read/agency.manage, write agency_type.manage. Exact string maxDebt including zero, all/active counts, safe blockers for any current debt including TERMINATED agencies; snapshots unchanged. |
| `/units` and `/units/{unitId}` | Five CRUD operations; read any unit.manage/product.manage/inventory.read, write unit.manage. Strict fraction flag defaults false; recorded document/count history freezes meaning, all references block deletion, inactive goods posting rejected. |

Catalogue IDs are strict integers; q/code/status and source sorts use bound literal
search and signed keyset pages. Unit lists also filter allowsFraction. New resource
cursors include bounded anchor ID/sort digest; changed/deleted/filter-mismatched
anchors return INVALID_CURSOR so clients restart instead of silently missing rows.
User ETags include joined group labels and serialize group renames. Mutations
require strong single If-Match where specified, return 428/412 on missing/stale
tokens, recheck live grants after lock waits, and commit before success.

Owning plans/evidence: [users](../openwiki/backend-design/plan/users/VERIFICATION.md),
[districts](../openwiki/backend-design/plan/districts/VERIFICATION.md),
[agency types](../openwiki/backend-design/plan/agency_types/VERIFICATION.md),
[units](../openwiki/backend-design/plan/units/VERIFICATION.md). Local gate: 207 offline,
217 PostgreSQL/TLS, 16 direct/Nginx cases and exact 100% combined statements/branches.
The M04/E05 numbers above are historical. Current combined M01–M16 gates:247
offline +370 PostgreSQL/TLS, exact100% (4096 statements/830 branches).
M15's20 direct/Nginx cases remain prior evidence; internal M16 did not rerun them.
Deploy reviewed head0006 explicitly before publishing these APIs.

## Permissions, audit, rules, products and agencies (M05/M06/M10–M12)

Twenty complete operations were added after owning six-file plans and required
dependency order; R2 is locally verified. Canonical details and current evidence:
[availability](../openwiki/backend-design/plan/full_backend/AVAILABILITY.md).

| Resource under `/api/v1` | Contract and behavior |
| --- | --- |
| `/functions[/{functionId}]` | Read-only 33-function registry; permissions.manage throughout. |
| `/user-groups/{groupId}/permissions[/{functionId}]` | permissions.manage list/detail/PUT. Absent grants require If-None-Match:*, existing grants strong If-Match. Both/missing headers422/428, raced/stale412; create201/Location/ETag, update200/ETag. False is stored; next request sees revocation. Parent lock serializes absent pairs/deletion. |
| `/audit-logs[/{auditId}]` | audit.read only; immutable correlated USER/SYSTEM entries, half-open time filters and ID/time keysets. Domain/BIGINT strings, exact arbitrary nested JSON number text and recursive provider/password/token/hash redaction. |
| `/business-rules` | GET any rules.manage/agency.manage/stock.issue.prepare/inventory.read; PATCH rules.manage+If-Match. Exact rate, positive global cap, blockers and serialized admission. Historical snapshots unchanged. |
| `/products[/{productId}]` | Five operations; read product.manage OR inventory.read, write product.manage. Generated MH-code, active units, zero cache, strict threshold, source provenance and exact quote. All recorded history blocks unit change/delete; eligible unused zero-cache delete is atomic. |
| `/agencies[/{agencyId}]` and `/{agencyId}/terminate` | Six operations; read agency.read OR agency.manage, write agency.manage. Generated DL-code, atomic active-master/cap checks, zero balances, type/debt/date guards and permanent debt-preserving termination. If-Match+UUID Idempotency-Key; replay rechecks grants after claim waits, conflicting payload409. Eligible unused zero-cache deletion retains history guards. |

D16 uses readable `DerivedSellingPrice` for Product/InventoryChange quotes; zero
and >Money quotes are never clamped. Later issue writers must use
`app.common.prices.stored_selling_price`: unusable quotes return409
SELLING_PRICE_UNUSABLE while stored PositiveMoney/Money bounds remain unchanged.
Source/disposable head0006 passed migrations, seed twice and54SQL checks;
external Supabase migration remains explicit.

## Documents, inventory and incoming goods (M13/M14/M15 core)

Shared `app/modules/document_core/` supplies SQL-owned table projections, all-kind
exact readers, historical snapshots, parent ETags, current-DRAFT line primitives,
revision construction and append-only batch/reversal helpers. Owning workflows
retain commit ownership. These internal foundations do not publish the full M28
history/line dispatcher.

| Resource under `/api/v1` | Published behavior |
| --- | --- |
| `/products/{productId}/inventory-entries` | inventory.read; signed immutable movements, effective/full history, source filter, half-open dates and scoped keysets. Opening/closing/running balances use the complete atomic business-date/order ledger before display filters. Historical balances use AggregateQuantity strings (D14); stored quantities remain bounded. |
| `/stock-receipts` | Authorized list and keyed create. Reads any receipt prepare/post/inventory.read; creation requires stock.receipt.prepare. Optional unique-product lines, ACTIVE masters, fraction policy, positive quantity/price, exact whole-VND line rounding; drafts change no balances. |
| `/stock-receipts/{documentId}` | Full stored snapshots and ETag; PATCH businessDate/note requires prepare and If-Match, current DRAFT only. |
| `/stock-receipts/{documentId}/post` | stock.receipt.post, If-Match and UUID Idempotency-Key. Nonempty positive-total draft, refreshed snapshots, one batch, ordered stock locks and commit-safe current inventoryChanges. Latest business-date/original-order receipt supplies price; backdated posting preserves frozen sales and money allocations. |

Internal draft cancellation requires documents.cancel and preserves lines/history.
Whole `/cancel` and `/corrections` remain unpublished until M29; public line editing
remains M28-gated. These are core delivery gates, not a complete document workbench.

Evidence and actual-symbol registers: [document core](../openwiki/backend-design/plan/document_core/VERIFICATION.md),
[inventory](../openwiki/backend-design/plan/inventory/VERIFICATION.md),
[receipts](../openwiki/backend-design/plan/stock_receipts/VERIFICATION.md).
Retained combined checks:219 offline+345 PG/TLS+20 direct/Nginx, exact100%; source/
disposable head0006, seed twice and54 SQL checks. No schema revision was needed.
Include `tests/integration/documents` in any explicitly selected business suite;
the standard combined non-deployment command includes it automatically.

## Internal financial settlement (M16)

`app/modules/settlement_core/` supplies exact FIFO at business-date/order checkpoints,
charge and receipt financial plans, conserved original cash provenance through
credit applications/returns, credit reserve/release/consume and append-only
chronological replay. Automatic receipts target only their original issue at its
atomic checkpoint. Manual collection requires full eligible allocation; actual
online/separated money preserves excess as same-source credit.

`SettlementService(session, actor_id, request_id, authorize)` exposes `lock`,
`post_receipt(document_id, key)` and `replay(agency_id, key, permission=...)`.
`ReservationService` supplies `reserve`, `release`, `consume`. These are internal
composition seams: owning domain writers supply current authorization, command
UUIDs, goods/evidence state, final deferred checks and the one commit. Repositories
never commit or write caches. No new public operation is mounted by M16.

The seven-kind financial capability register supports existing frozen return
totals, credit applications and exact paid/active refund sources in the seed.
It does not complete M23 return-line rounding, M27 provider/refund workflows or
M29 corrections. Provisional lot ordinals match eventual insertion order; protected
minima are retained across duplicate lots, receipt origins and later returns.

[Owning evidence](../openwiki/backend-design/plan/settlement_core/VERIFICATION.md):
28 offline+25 PG cases added;617 combined pass with per-file exact100%. Relevant
suite paths are `tests/settlement_core` and `tests/integration/settlement_core`.
At the historical M16 checkpoint source head was0006; current source/configured head is0007.

## Stock issues, manual receipts, upfront money and receivables (M17–M20)

Twenty-two operations were added at the M17–M20 checkpoint (then80target+2health):

| Resource | Implemented behavior |
| --- | --- |
| `/stock-issues` and `/{documentId}` | List/detail, keyed create and conditional draft headers; server-derived line prices, immutable agency, neutral drafts. |
| `/stock-issues/{documentId}/submit` | Freeze READY price/contact/rate/limit snapshots after active-master, stock and anticipated-net-debt checks; no stock/debt reservation. |
| `/stock-issues/{documentId}/post` | Preserve READY content, recheck stock/current limit, atomically post stock/charge and optional verified automatic receipt, then replay financial history. |
| `/stock-issues/{documentId}/revisions` | Preserve prior READY history, create a fresh draft; VERIFIED cash must be separated first. |
| `/payment-receipts` and `/{documentId}[/post]` | Manual CASH/BANK_TRANSFER debt-collection draft/header/post and all-kind receipt reads. Date-valid FIFO, no manual overpay/future-invoice payment; automatic/online/separated receipts reject standalone mutation. Terminated agencies may repay. |
| `/upfront-confirmations` and `/{confirmationId}` | List/detail/keyed exact current-READY verification; VERIFIED changes no balances. |
| `/upfront-confirmations/{confirmationId}/receive-separately` | Conditional keyed full-cash receipt at receivedAt's Vietnam date; eligible FIFO/excess source credit, one evidence transition. |
| `/receivables`, `/agencies/{agencyId}/balance`, `/agencies/{agencyId}/invoice-balances`, `/agencies/{agencyId}/receivable-entries` | Minimal financial identities, shared balance, current invoice balances, atomic ledger statements; exact full-filter totals and common asOf. |
| `/stock-issues/{documentId}/balance`, `/documents/{documentId}/allocations` | Posted invoice balance and source/target allocations, including append-only reversal history. |

All canonical permissions/preconditions/media/statuses are tested. Historical
statement opening/closing/running debt uses AggregateMoney after a persisted1.2e18
witness; stored/current/invoice values retain Money bounds. Financial current-balance
overflow returns409/BALANCE_OVERFLOW and rollback. Public shared lines/history and
posted cancel/corrections remain M28/M29; these core deliveries are not full workbenches.

Historical M17–M20 verification: **80owning cases**, exact100% over808statements/98branches across new
modules/shared composition; **22direct/Nginx cases**. All370retained PG/TLS nodes pass
across saved/resumed runs. Current total308offline+397PG/TLS=**705non-deployment cases**.
Affected M16–M20/shared production coverage is33files/1285statements/306branches
exact100%, distinct from historical whole-backend/harness coverage.
[Owning commands/evidence](../openwiki/backend-design/plan/stock_issues/VERIFICATION.md).
Configured Supabase was explicitly upgraded0002→0006; live integrity verifies the
existing410documents/30agencies/24products. No Docker database was created.

### Explicit isolated Supabase verification

```powershell
$env:SUPABASE_TEST_SCHEMAS='1'
uv run --frozen --no-sync pytest tests/workflows tests/integration/workflows -m 'not deployment' -q --tb=short
```

This opt-in uses configured Supabase DB_* settings and generated disposable
`agentra_test_<uuid>` schemas plus separate migration metadata, never the business
schema for fixtures. Queries and schema reflection are scoped; cleanup drops only
the generated schemas. Without opt-in, guarded disposable test-database URLs remain
required. Race-test wait budgets account for remote latency only with this flag;
actual PostgreSQL blocking relationships and final state assertions remain mandatory.
Deployment smoke accepts `AUTH_SMOKE_TIMEOUT_SECONDS` (default10;90 used for Supabase).

## Adjustments, counts, returns and credit (M21–M24)

Runtime now publishes103target operations+2health; source and configured Supabase
head0007. Four owning implementations pass their declared roadmap scopes:

| Resource | Implemented behavior |
| --- | --- |
| `/stock-adjustments` and `/{documentId}[/post]` | List/detail/create/header/post with nonzero signed quantities, required reason, zero price/total and no cash or purchase-price-source effects. Internal draft cancellation; confirmed count links protected. |
| `/stock-counts`, `/{countId}`, `/{countId}/lines[/{lineId}]`, `/{countId}/recount`, `/{countId}/confirm` | Ten operations; capture book quantity and private last-entry identity, fresh all-product recount, parent ETags, zero-difference evidence without an empty adjustment, conditional stock.adjustment.post and atomic linked posting. No delete. |
| `/sales-returns` and `/{documentId}[/post]` | Original posted issue-line provenance, exact cumulative HALF_UP including zero increments, stock/debt/receipt-backed credit and immutable dependent-return successors for backdated insertion. No automatic cash refund. |
| `/agencies/{agencyId}/credit-lots`, `/credit-lots/{lotId}`, `/agencies/{agencyId}/credit-entries` | Source/receipt/lot reads, reserved versus available credit, atomic historical/reversal statements and scoped pages. Agency balance remains the sole M20 route. Internal AvailableCreditService reuses M16 writer locks without committing. |

M21/M23 posted correction/full cancellation and public shared goods lines/history
remain M29/M28-owned. Credit applications, online payments and refunds remain M25–M27.
Credit historical balances use AggregateMoney after the real1.2e18/current7e17 witness;
all stored/current/lot Money bounds remain unchanged. Reviewed0007 preserves original
lot IDs and cash provenance when a rounding-only successor changes a posted return.

Owning evidence: [M21](../openwiki/backend-design/plan/stock_adjustments/VERIFICATION.md),
[M22](../openwiki/backend-design/plan/stock_counts/VERIFICATION.md),
[M23](../openwiki/backend-design/plan/sales_returns/VERIFICATION.md),
[M24](../openwiki/backend-design/plan/agency_credit/VERIFICATION.md).
Actual packet338offline+84realPG (29owning+55retained)+24direct/Nginx cases pass.
All30affected production files, including changed shared code and the new migration,
have exact100% over1162statements/162branches with zero missing/excluded/partial coverage.
The59new owning cases and current84PG/24deployment node inventories are independently
checked against saved passing phases. Historical705-case baseline remains historical.
