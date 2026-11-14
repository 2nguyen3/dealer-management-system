# Agentra - Dealer Management System

AI development setup: [OpenCode and Claude Code guide](.agent/README.md).

> Đồ án môn Nhập môn Công nghệ Phần mềm  
> Trường Đại học Công nghệ Thông tin, ĐHQG-HCM

## Giới thiệu

Agentra là hệ thống quản lý đại lý (Dealer Management System), hỗ trợ quản lý hoạt động phân phối hàng hóa cho các đại lý.

Hệ thống giúp quản lý thông tin đại lý, quá trình nhập và xuất hàng, thanh toán, công nợ và báo cáo kinh doanh. Dự án được thực hiện nhằm vận dụng các kiến thức về khảo sát yêu cầu, phân tích, thiết kế, xây dựng và kiểm thử phần mềm.

## Thành viên thực hiện

| STT | Họ và tên | MSSV | Vai trò |
|:---:|---|:---:|---|
| 1 | Nguyễn Trần Thảo Nguyên | 23521052 | Nhóm trưởng |
| 2 | Nguyễn Thúy Ngân | 23520996 | Thành viên |
| 3 | Nguyễn Hà Minh Tuấn | 23521718 | Thành viên |
| 4 | Huỳnh Gia Phúc | 24521376 | Thành viên |

## Giảng viên hướng dẫn

**TS. Đỗ Thị Thanh Tuyền**

## Development setup

Business simplification 2026-11-14: three document kinds (stock receipt, stock issue,
payment receipt), agency debt/product stock columns, VNPAY sandbox, five reports and a
dashboard — 90 API operations. Revision 0011 rebuilt schema `dms` and seed v2 replaced
all data (accounts below). Plan and exact evidence:
[simplification](openwiki/backend-design/plan/simplification/VERIFICATION.md). The dated
paragraphs that follow describe the earlier application and are historical.

Backend review2026-10-30:1088offline tests pass; report/dashboard/API/response scope
is717statements/140branches exact100%. Fixed test-artifact isolation, early invalid-JWT
rejection and large-value sales-rate rounding; isolated PostgreSQL boundary and PDF
geometry checks pass. Supabase0009/live integrity retains411documents/30agencies/
24products. Docker Engine is currently unavailable; today's fixes were not rebuilt
or deployed. Health/image claims in older dated checkpoints below are historical.
[Exact verification](openwiki/backend-design/plan/full_backend/VERIFICATION.md).

Current M31 checkpoint2026-10-29: dashboard published153/154business+2health at0009,
chatbot alone absent. Final1084offline incl291dashboard,14unique owningPG,
3dashboard+8retained direct/proxy/public cases pass; dashboard161/24/API68/0exact.
[Evidence](openwiki/backend-design/plan/dashboard/VERIFICATION.md). Live411documents/
30agencies/24products and acceptedpayment/receipt/event preserved. Docker/ngrokhealthy,
frontendunchanged. Next M32 uses user's AI API; details/D10 remain in HANDOFF, not coded.
The earlier checkpoints below are historical, not current runtime counts.

Earlier backend checkpoint2026-10-29: all twelve M29 posted correction/cancel and
all five M30 report operations are published:152/154business operations+2health,
source/image/configured Supabase0009. Reports support JSON and full-filter XLSX/PDF.
Final1083offline,11unique owningM30PG and11unique direct/proxy/public endpoint cases
pass across documented resumes; [current evidence](openwiki/backend-design/plan/reports/VERIFICATION.md).
Live411documents/30agencies/24products and original VNPAY payment37/10200VND/receipt774/
oneevent are preserved. External refund remains PENDING, not paid. Next M31 dashboard,
then M32 chatbot and final release gates. Docker/ngrok are running, frontend unchanged.
Use ordinary `python -m app.db.verify` for live integrity; the410-document original
seed is historical, not a reset target.

| Component | Stack | Documentation |
|---|---|---|
| API | Python 3.12, FastAPI, SQLAlchemy, Alembic | [Backend setup](backend/README.md) |
| Database | Neon PostgreSQL 18 (Singapore, `aws-ap-southeast-1`) | [Connection configuration](backend/README.md#supabase-connection) |
| Frontend | React, Vite, TypeScript | [Frontend setup](ui/README.md) |
| Deployment | Docker Compose, unprivileged Nginx | See below |

### Vercel deployment

Deploy from the repository root. `vercel.json` builds the Vite frontend and FastAPI
backend as two Vercel Services in one project. `/api` and `/api/*` reach FastAPI
without stripping the prefix; other paths reach the frontend, including SPA deep
links. Vercel does not host PostgreSQL itself; the database is Neon (Vercel Marketplace)
in Singapore, and `vercel.json` pins functions to `sin1` next to it. Keep the function
region and database region together: every SQL statement is a network round trip.

Database move 2026-11-10: the former Supabase Sydney database (`ap-southeast-2`) was
copied with `pg_dump -n dms -e pg_trgm --no-owner --no-privileges` into Neon, the four
`REVOKE ... FROM PUBLIC` statements of 0001/0004 were reapplied, `public.alembic_version`
was stamped `0009`, all 30 table row counts matched, and `app.db.verify --seeded
--regression` passed through the pooled host. Production `DB_*` were replaced with
`deploy_vercel_env.py --env-file .env.neon --database-only --update-existing`. The
Sydney project is retained untouched as a rollback source (`backend/.env.supabase-sydney`).
Measured API latency dropped from 2.3–7.4 s to about 0.25 s per request.

```powershell
npx --yes vercel@65.12.1 login
npx --yes vercel@65.12.1 link
```

After linking the intended project, run from `backend/`:

```powershell
uv sync --frozen
uv run python deploy_vercel_env.py --environment preview
```

The helper uploads the existing `DB_*`, authentication signing key/issuer/audience,
and same-origin CORS configuration from local backend settings through stdin.
Values are stored as Vercel Secrets, never printed or passed as command arguments.
By default it refuses to overwrite existing variables; `--update-existing` explicitly
allows replacing only the selected keys. Use `vercel env ls` to inspect variable names.
The default mode does not upload mail/payment/provider credentials or local callback
URLs. Native VNPAY Sandbox has a separate, explicit mode below. `VITE_API_BASE_URL`
should remain unset (defaults to same-origin `/api/v1`); never expose backend secrets
through `VITE_*` variables. Do not change existing local provider callbacks.

Then deploy a preview from the repository root:

```powershell
npx --yes vercel@65.12.1 deploy --environment preview
```

Vercel requires a new project's first deployment to target Production. In that
case, first approve the production release and upload production variables as
described below; do not expect preview-only variables to apply to Production.

Verify `/`, a frontend deep link, `/api/v1/health`, `/api/v1/health/ready`, and
`/api/docs` on the returned URL. Readiness checks connectivity only, not migration
revision. Neither builds nor startup run migrations or seed commands. Preserve the
live database and its historical/accepted payment records.

For an explicitly approved production release, upload production variables using
`uv run python deploy_vercel_env.py --environment production` from `backend/`, then
run `npx --yes vercel@65.12.1 deploy --prod` from the repository root.

To configure native VNPAY Sandbox, run from `backend/`:

```powershell
uv run python deploy_vercel_env.py --vnpay --check
uv run python deploy_vercel_env.py --vnpay --environment production --update-existing
```

This mode uploads only `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_IPN_URL`,
`VNPAY_RETURN_URL`, `VNPAY_PAYMENT_URL` and `VNPAY_API_URL`. Existing local merchant
credentials are preserved; callback values for the cloud are the stable
`https://agentra-dms.vercel.app/api/v1/integrations/vnpay/ipn` and `/return` URLs.
Local `.env` files and ngrok settings are not modified. The merchant-side IPN URL
is already registered by the owner; no portal change is part of this deployment.
Keep the separate controlled `PAYMENT_*` integration unset. The Settings contract
permits only VNPAY Sandbox checkout/query hosts, never live-bank endpoints.
Redeploy after uploading variables. Provider Return is read-only and links to the
authenticated payment workbench; verified IPN/query evidence remains the authority.

Deployment caveats: the existing application limiter is process-local, not shared
across autoscaled instances. A shared limiter is required for deployment-wide
enforcement; this configuration does not claim production security acceptance.
Budget database pool connections for scaling, and validate SMTP/provider callbacks
and large PDF/XLSX exports against Vercel function limits before release. Secrets,
local runtime data, virtual environments, tests and tool caches are excluded from
CLI uploads by `.vercelignore`. PDF fonts remain included in the backend bundle.

Initial read-only deployment verified 2026-11-09: [Agentra](https://agentra-dms.vercel.app),
[API docs](https://agentra-dms.vercel.app/api/docs), and
[database readiness](https://agentra-dms.vercel.app/api/v1/health/ready).
Root/login/dashboard routes and API health/docs return 200; unknown API routes and
missing assets return 404. Desktop and mobile Chrome load the login screen without
failed requests, JavaScript exceptions or horizontal overflow. These smoke checks
do not submit forms or mutate business data. Supabase remains the existing database;
no migrations, seed, reset or data transfer was performed. GitHub linking was not
available, so this deployment uses CLI uploads rather than automatic push deployments.

Full staging acceptance on 2026-11-09 UTC uses production deployment
`dpl_33kXQAE3R68ADFrz7D5gjtHGzJva` at the same alias. Native sandbox credentials
and both Vercel callback URLs are configured. Actual frontend-created sandbox
payment **41 / 10,000 VND** completed through NCB test-card/OTP checkout. Automatic
IPN recorded **SUCCESS / posted receipt 775 / one provider event** before any manual
callback replay or reconciliation. The real signed Return validated and linked to
the correct authenticated frontend detail. Replaying that actual signed callback
returns `RspCode=02`, with one event, unchanged document count and exactly
`-10000` VND receivable allocation. No real-money credentials/endpoints were enabled.

Three earlier incomplete sandbox attempts (38-40) remain as pending test records;
they have no receipt/financial posting. Existing business rows were fingerprinted
before testing: no original document/revision/line/ledger/event changed or disappeared.
Original payment37/receipt774/10,200VND remains intact. Current live integrity passes
30 tables, 412documents/31agencies/24products at schema0009; the one new receipt is
the authorized sandbox settlement, not a reseed or migration.

Current checks: 1,118 offline backend tests pass; eight selected isolated PostgreSQL
recovery cases pass; 243 frontend tests pass; TypeScript/Vite build, ESLint and Ruff
lint/format checks pass. Changed VNPAY dependency/Return transport scope is exact
100% (80 statements/20 branches), not whole-backend coverage. Public liveness,
readiness/docs, authenticated reads, dashboard, all five reports, PDF/XLSX exports,
login/refresh/logout and mobile smoke pass. The whole PostgreSQL suite, exhaustive
business mutation workflows, load/concurrency scale and largest-export limits are
not newly accepted by this staging checkpoint. Shared multi-instance rate limiting,
SMTP delivery and automatic GitHub push deployments remain separate work.

### Run locally

Prerequisites: Python 3.12, uv, Node.js 24 LTS, and a Supabase project.

1. Copy `backend/.env.example` to `backend/.env`, verify the Supabase `DB_HOST`,
   `DB_PORT`, `DB_NAME`, and `DB_USER`, and fill in `DB_PASSWORD`. Set a backend-only
   random `AUTH_SIGNING_KEY` with at least 32 UTF-8 bytes; do not commit either secret.
2. In `backend/`, run:

   ```sh
   uv sync --frozen
   uv run alembic upgrade head
   uv run python -m app.db.seed
    uv run uvicorn app.main:create_app --factory --reload --no-proxy-headers
   ```

3. In a second terminal, in `ui/`, run:

   ```sh
   npm ci
   npm run dev
   ```

Open http://localhost:5173. API docs are at http://localhost:8000/api/docs.
Environment files are ignored by Git; commit only the example templates.

### Database và dữ liệu

Từ 14/11/2026 ứng dụng dùng mô hình đã đơn giản hóa
([kế hoạch](openwiki/backend-design/plan/simplification/PLAN.md),
[bằng chứng](openwiki/backend-design/plan/simplification/VERIFICATION.md)).
Revision `0011` (`backend/alembic/sql/0011_simplified_schema.sql`) xóa và dựng lại
schema `dms` gồm 16 bảng, 22 chức năng phân quyền, đồng hồ nghiệp vụ `dms.clock`,
trigger bảo vệ số dư (`agency.debt`, `product.stock`, `product."lastPurchasePrice"` chỉ
đổi khi ghi sổ/hủy chứng từ) và index tìm kiếm. Revision này không downgrade được; dữ
liệu cũ trên production đã được backup trước khi nâng cấp (xem VERIFICATION). Production
14/11/2026: seed v2 chạy trên PostgreSQL local rồi chép schema `dms` lên Neon bằng
`pg_dump`/`pg_restore` trong một transaction, sau đó `verify --seeded --regression` chạy
trực tiếp trên Neon (seed qua mạng tới Neon mất ~70 phút). Thiết kế
ở [openwiki/database-design](openwiki/database-design/README.md). Migration không tự
chạy khi khởi động API.

Từ `backend/`:

```powershell
uv sync --frozen
uv run alembic upgrade head
uv run python -m app.db.seed
uv run python -m app.db.verify --seeded --regression
```

Seed v2 mô phỏng hoạt động thật của công ty từ **01/06/2026 đến hôm trước ngày seed**:
mỗi thao tác đặt giờ hành chính trên `dms.clock` rồi đi qua chính `DocumentService`
như API (không tắt trigger, không ghi số dư trực tiếp). Lần đầu cần schema `0011` còn
trống; chạy lại chỉ kiểm tra, không tạo trùng hay đổi mật khẩu. `verify --seeded` đối
chiếu tài khoản/hash mật khẩu, khối lượng, replay tồn kho/nợ/giá, báo cáo khớp số nợ,
giờ hành chính, số điện thoại/địa chỉ và quét từ cấm (không có "mẫu/demo/test");
`--regression` chạy thêm 83 kiểm tra PostgreSQL trong schema riêng rồi rollback.

**Số liệu seed v2 (seed ngày 14/11/2026, kiểm tra trên PostgreSQL 18):**

| Nội dung | Số lượng |
|---|---|
| Nhóm / chức năng / phân quyền | 4 nhóm, 22 chức năng, 88 dòng phân quyền |
| Tài khoản | 11 (10 hoạt động, 1 bị khóa) |
| Quy định / danh mục | Tối đa 4 đại lý/phường, tỷ lệ giá bán 1,02; 2 loại đại lý (hạn mức 50.000.000đ và 20.000.000đ); 168 phường/xã; 8 đơn vị tính |
| Đại lý | 34 (3 đã chấm dứt hợp tác); có một phường đã đủ 4 đại lý |
| Mặt hàng | 30 (2 ngừng bán, 1 chưa từng nhập nên chưa có giá) |
| Chứng từ | 468: phiếu nhập 90, phiếu xuất 255, phiếu thu 123 (nháp 8, đã hủy 13, sửa thay thế 5); 1.270 dòng hàng |
| Phiếu thu | Tiền mặt 65, chuyển khoản 47, VNPAY 11 |
| Thanh toán VNPAY | 19 giao dịch: 11 thành công, 5 thất bại, 3 hết hạn; một đại lý có nợ âm do tiền VNPAY về muộn |
| Nhật ký | 4.020 bản ghi, không chứa mật khẩu/token |

### Tài khoản đăng nhập

Tài khoản ứng dụng trong `dms.app_user` (không phải tài khoản PostgreSQL). Mật khẩu
lưu dạng **Argon2id**. Bốn thành viên nhóm giữ bốn vai trò chính.

| Email | Mật khẩu | Họ tên | Nhóm | Trạng thái |
|---|---|---|---|---|
| `thaonguyen@agentra.vn` | `Agentra@2026#QuanLy1` | Nguyễn Trần Thảo Nguyên | Quản lý | ACTIVE |
| `minhtuan@agentra.vn` | `Agentra@2026#KinhDoanh1` | Nguyễn Hà Minh Tuấn | Kinh doanh | ACTIVE |
| `giaphuc@agentra.vn` | `Agentra@2026#Kho1` | Huỳnh Gia Phúc | Kho | ACTIVE |
| `thuyngan@agentra.vn` | `Agentra@2026#KeToan1` | Nguyễn Thúy Ngân | Kế toán | ACTIVE |
| `hoangnam@agentra.vn` | `Agentra@2026#KinhDoanh2` | Lê Hoàng Nam | Kinh doanh | ACTIVE |
| `myduyen@agentra.vn` | `Agentra@2026#KinhDoanh3` | Võ Thị Mỹ Duyên | Kinh doanh | ACTIVE |
| `thuha@agentra.vn` | `Agentra@2026#Kho2` | Phạm Thu Hà | Kho | ACTIVE |
| `quocbao@agentra.vn` | `Agentra@2026#Kho3` | Đặng Quốc Bảo | Kho | ACTIVE |
| `ngochan@agentra.vn` | `Agentra@2026#KeToan2` | Trần Ngọc Hân | Kế toán | ACTIVE |
| `thanhtung@agentra.vn` | `Agentra@2026#KeToan3` | Bùi Thanh Tùng | Kế toán | ACTIVE |
| `vanluc@agentra.vn` | `Agentra@2026#KinhDoanh4` | Phan Văn Lực | Kinh doanh | LOCKED (đăng nhập bị từ chối) |

Quyền mặc định: Quản lý có toàn bộ 22 chức năng (gồm hủy/sửa chứng từ); Kinh doanh
tiếp nhận đại lý và lập phiếu xuất; Kho quản lý mặt hàng/đơn vị, lập và ghi sổ phiếu
nhập, ghi sổ phiếu xuất; Kế toán lập/ghi sổ phiếu thu, VNPAY và xem báo cáo.

### Backend authentication

Seven `/api/v1/auth/*` operations are implemented: login, refresh, logout, current
user/permissions, password change, reset-email request and single-use password reset.
Each protected request checks the current PostgreSQL session/version and group grants.
Password/group/status changes invalidate old tokens; logout ends only its session.

Configure `AUTH_SIGNING_KEY` before API startup. Password-reset mail is disabled by
default and returns account-independent 503 until the SMTP sender/host, TLS mode and
frontend reset URL are configured. The reset page itself is a later frontend feature.
See [backend auth configuration](backend/README.md#authentication) and
[verification evidence](openwiki/backend-design/plan/authentication/VERIFICATION.md).

Backend features now use `backend/app/modules/<feature>/`, shared API helpers in
`app/common/`, and infrastructure in `app/core/`/`app/db/`. See the
[backend structure](backend/README.md#structure) and
[2026-10-04 refactor verification](backend/REFACTOR_VERIFICATION.md).

The initial limiter requires one worker/replica. Forwarded-header trust is disabled;
Nginx traffic shares its peer-address bucket. Local verification covers real PostgreSQL
races, TLS SMTP, 100% scoped statements/branches and direct/Nginx smoke. External
provider mail remains an operational step; configured Supabase now runs source head `0009`.

### Docker deployment

Prerequisites: Docker Engine 25+/Docker Desktop with Compose 2.20.2+ and a configured
`backend/.env`. Supabase remains an external managed database.
`AUTH_SIGNING_KEY` must be configured before starting the backend.
Compose loads native VNPAY sandbox settings directly from `backend/.env`;
see [VNPAY setup](backend/README.md#vnpay-sandbox-preparation).

From the repository root:

```sh
docker compose build
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm migrate python -m app.db.seed
docker compose up -d --wait --wait-timeout 120
docker compose ps
```

- Application: http://localhost:8080
- API docs: http://localhost:8080/api/docs
- Direct backend docs: http://localhost:8000/api/docs
- Database readiness: http://localhost:8080/api/v1/health/ready

The frontend port is published, and backend port 8000 is bound to localhost for
direct API and documentation access. Nginx forwards `/api/` requests to FastAPI
over the internal Docker network. Both containers run as non-root users and
have health checks. Set `WEB_PORT` in your shell (or a root `.env`) to change
the default 8080 port. For an internet deployment, terminate HTTPS at your
hosting platform's ingress or reverse proxy.

Compose defines two long-running services and one optional tool:

| Service | Role | Host access | Writable host storage |
| --- | --- | --- | --- |
| `backend` | Non-root FastAPI/Uvicorn, explicitly one worker | `127.0.0.1:${API_PORT:-8000}` | `data/backend/` → `/app/data` |
| `frontend` | Non-root Nginx serving the compiled React UI and proxying `/api/` | `${WEB_PORT:-8080}` | `data/frontend/` → `/var/cache/nginx` |
| `migrate` | Explicit Alembic/seed CLI in the `tools` profile | No published port | Shares `data/backend/` → `/app/data` |

The bind mounts are relative to this repository's root. Backend `TMPDIR` points to
`/app/data`; Nginx uses `client_temp/` and `proxy_temp/` beneath its mounted directory.
These files survive image rebuilds, container recreation and `docker compose down`.
The entire `data/` folder is ignored by Git. Business records live in Supabase;
application code, dependencies and compiled static assets are included in the images.

```text
data/                          # Created on the host; ignored by Git
├── backend/                   # API runtime and Python temporary files
└── frontend/
    ├── client_temp/           # Nginx request-body buffers
    └── proxy_temp/            # Nginx upstream-response buffers
```

Docker Desktop on Windows provides writable shared folders. For a Linux host, prepare
the current runtime users' permissions before first startup:

```sh
mkdir -p data/backend data/frontend
sudo chown -R 999:999 data/backend
sudo chown -R 101:101 data/frontend
```

The current backend runs as UID/GID `999:999`, frontend as `101:101`; inspect `id`
inside each service if base images change. Compose creates absent bind-source
directories, which can need the same ownership adjustment on Linux. Temporary-file
cleanup follows the creating application; check disk usage before removing abandoned
runtime files while the services are stopped.

Health checks and lifecycle settings:

- Backend checks writable runtime storage and the exact JSON response from
  `/api/v1/health/ready`, including database connectivity, every 30 seconds with a
  10-second probe limit and a 30-second startup grace period. The frontend starts
  after the backend is healthy, so valid
  `DB_*` settings and a reachable Supabase database are required.
- Frontend checks writable cache storage, the compiled index, local Nginx `/healthz`
  and proxied `/api/v1/health/ready` every 30 seconds, with a 15-second probe limit
  and 20-second startup grace period. Its Compose health reflects API/DB readiness too.
- Both probes use five-second intervals during startup and three retries. The public
  Nginx `/healthz` endpoint itself remains a local Nginx liveness check.
- The one-off migration service has HTTP health checks disabled.
- All services use the `app` bridge network, with outbound access to Supabase.
- Container logs rotate at 10 MB, keeping three files per container.
- Graceful shutdown allows 30 seconds for the backend/migrations and 15 for Nginx.
- An explicit Compose backend update also restarts its dependent frontend. Both
  services use an init process, SIGTERM and `no-new-privileges`.
- `API_PORT` overrides the localhost-only backend port (default `8000`).
- `VITE_API_BASE_URL` overrides the frontend Docker build argument (default `/api/v1`).
  Set Compose overrides in your shell or a root `.env`; `ui/.env` is for local Vite.

A failed health check marks a container unhealthy; it does not itself restart it.
`unless-stopped` restarts the long-running services when their processes exit.
The frontend dependency is a startup gate, not ongoing monitoring of the backend.

```sh
docker compose logs -f
docker compose down
```

Dependency lockfiles (`backend/uv.lock` and `ui/package-lock.json`) are included
for reproducible installs. Database objects, full demo data and backend authentication
are implemented, together with shared business API conventions, group/user
administration, master data, document/stock receipt foundations, stock issues,
manual receipts, upfront payments and receivables (80 target operations plus two
health operations). The UI remains a starter screen; next backend code is M21
stock adjustments after the verified M17–M20 handoff.

### Backend implementation planning

The [full backend plan](openwiki/backend-design/plan/full_backend/PLAN.md) covers
all 154 target operations, 32 implementation slices, transaction/replay design,
schema/contract gaps and verification gates. Its
[execution sequence](openwiki/backend-design/plan/full_backend/EXECUTION.md) defines
22 delivery packets, migration checkpoints and frontend-ready release bundles.
The active [full-backend goal](openwiki/backend-design/plan/full_backend/GOAL.md)
tracks delivery through the final R6 gate. M02 foundations and M03 user groups are
locally verified alongside administration/master data and M13–M16 foundations.
M17–M20 implementation, scoped gates and retained prerequisite regression pass.
See [current available operations](openwiki/backend-design/plan/full_backend/AVAILABILITY.md).
Business implementation progress remains in the
[backend checklist](openwiki/backend-design/GENERAL_CHECKLIST.md).
