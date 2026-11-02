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
| Database | Supabase-hosted PostgreSQL | [Connection configuration](backend/README.md#supabase-connection) |
| Frontend | React, Vite, TypeScript | [Frontend setup](ui/README.md) |
| Deployment | Docker Compose, unprivileged Nginx | See below |

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

### Database và dữ liệu demo

Schema `dms` trên Supabase hiện cùng source/runtime ở head`0009`. Live verifier
đối chiếu411chứng từ/30đại lý/24mặt hàng; gồm410chứng từ seed gốc và phiếu thu VNPAY
đã được chấp thuận, không reset dữ liệu về số seed cũ. Thiết kế ở
[openwiki/database-design](openwiki/database-design/README.md);
DDL có version nằm trong `backend/alembic/sql/`. Migration tạo đầy đủ 29 bảng,
3 domain số chính xác, sequence, FK/CHECK/index, trigger toàn vẹn/audit,
5 view và các hàm báo cáo; revision `0002` thêm index tìm kiếm `pg_trgm`,
revision `0003` thêm version/session cho token và thu hồi token lịch sử;
revision `0004` thêm bảng hạ tầng lưu command/retry (tổng 30 bảng vật lý);
revision `0005` khóa chính sách đơn vị trước khi kiểm tra số lượng, bảo vệ lịch sử.
Revision `0006` sửa xóa hồ sơ/hàng chưa dùng cùng cache0, khóa first-use mặt hàng
và ngày tiếp nhận/lịch sử đại lý. Migration không tự chạy khi khởi động API.
Revision `0007` giữ credit lot gốc khi tạo successor để tính lại làm tròn cùng phiếu trả,
bảo toàn reservation/refund đã trả và nguồn phiếu thu.
Revisions `0008`/`0009` bổ sung chính sách master lịch sử cho sửa phiếu nhập/xuất.

Backend M01–M14, M15 core và M16 settlement nội bộ đã qua gate cục bộ:
58/154 operation mục tiêu +2health;247 offline +370 PostgreSQL/TLS,
scoped100% (4096 statements/830 branches).20 direct/Nginx là bằng chứng M15 trước
đó, không chạy lại trong M16 nội bộ. Đã có FIFO, provenance, reservation và replay
tài chính. M17–M20 hiện đã thêm22operation xuất hàng/phiếu thu/trả ngay/công nợ:
80/154operation+2health. Gate riêng80case/exact100%(808statements/98branches)
và22direct/Nginx đã pass;370casePG/TLS regression trước cũng pass qua các lần chạy
checkpoint/resume. Tổng mới308offline+397PG/TLS=705case ngoài deployment; scope33file
production bị ảnh hưởng đạt100%(1285statements/306branches). Đây là checkpoint lịch sử M17–M20.
Ngày2026-10-18, M21 điều chỉnh kho, M22 kiểm kê, M23 trả hàng core và M24 dư có đã có
implementation/owning plan và pass59case riêng. Packet338offline+84PG+24direct/Nginx pass,
scope30file production1162statements/162branches exact100%. Runtime103/154operation+2health,
source/Supabase0007. Docker Desktop/backend/frontend healthy, API trực tiếp
và qua Nginx readiness200; live integrity giữ410chứng từ/30đại lý/24mặt hàng.
Các số liệu M17–M24 ở trên là lịch sử. M25–M30 hiện đã được triển khai; đầy đủ
API sửa/hủy và dòng/lịch sử đã có evidence riêng. Tiếp theo M31/M32; các gate
release tổng thể R5/R6 và terminal bank refund vẫn tách riêng, chưa đóng.
[Trạng thái operation](openwiki/backend-design/plan/full_backend/AVAILABILITY.md)
và [mục tiêu đang chạy](openwiki/backend-design/plan/full_backend/GOAL.md) là nguồn
handoff hiện tại. UI nghiệp vụ vẫn cần kế hoạch/implementation/test riêng.

Từ `backend/`, sử dụng môi trường ảo và dependency lockfile:

```powershell
uv sync --frozen
. .\.venv\Scripts\Activate.ps1
alembic upgrade head
python -m app.db.seed
python -m app.db.verify --seeded --regression
```

Có thể dùng `uv run` thay cho activate, ví dụ `uv run python -m app.db.seed`.
Seed chạy trong **một transaction**, không tắt trigger và không sửa cache tồn/nợ
trực tiếp. Chạy lại bộ demo v1 chỉ kiểm tra dữ liệu hiện có, không tạo trùng hay
ghi đè mật khẩu. Lần seed đầu yêu cầu các bảng dữ liệu ứng dụng còn trống; bộ
seed không tự xóa database đã có dữ liệu khác.

**Dữ liệu đã seed và kiểm chứng trên Supabase PostgreSQL 17.6:**

| Nội dung | Số lượng / độ phủ |
|---|---|
| Nhóm / chức năng / phân quyền | 4 nhóm, 33 chức năng, 132 phân quyền |
| Tài khoản / token | 8 tài khoản; 16 token digest đã thu hồi, không có session demo đang sống |
| Quy định / danh mục | 1 quy định, 2 loại đại lý, 20 quận mẫu, 6 đơn vị |
| Đại lý | 30; có đại lý mới chưa giao dịch, trùng tên khác quận và ngừng hợp tác |
| Mặt hàng | 24; có đơn vị lẻ, hàng ngừng bán, tồn thấp và hàng chưa nhập |
| Chứng từ | 410 chứng từ, 411 phiên bản, 766 dòng; đủ 7 loại chứng từ |
| Sổ kho / phải thu / dư có | 753 / 486 / 5 bút toán; cache đối chiếu được với ledger |
| Thu tiền | Tiền mặt, chuyển khoản, online; FIFO, trả ngay và tiền online dư thành dư có |
| Thanh toán online | 20 payment, 19 event mô phỏng; PENDING / SUCCESS / FAILED / EXPIRED |
| Trả hàng / bù / hoàn tiền | Giảm nợ chưa trả, dư có từ hàng đã trả tiền, bù nợ, hoàn cash/online |
| Hoàn tiền online | 4 attempt: SUCCESS / PENDING / UNKNOWN / FAILED; 5 reservation giữ/tiêu/giải phóng tiền |
| Kiểm kê | 3 biên bản, 36 dòng; có chênh lệch, không chênh lệch và nháp |
| Audit | 3.740 bản ghi tự sinh, không chứa password/token hash |

Lịch sử nghiệp vụ trải từ **01/06/2026 đến 30/09/2026**, đủ dữ liệu xem báo cáo
tháng và so sánh tồn/công nợ/doanh số nhiều kỳ. Chứng từ có nháp, chờ xác nhận,
đã ghi nhận, đã hủy; có sửa phiên bản và bút toán đảo. Các callback/refund đều
là bằng chứng **mô phỏng** có đánh dấu `demo`, không gọi cổng thanh toán thật.
Các tên quận là danh mục demo theo mô hình quận trong thiết kế.

### Tài khoản đăng nhập mẫu

Đây là tài khoản **demo của ứng dụng** trong `dms.app_user`, không phải tài khoản
Supabase Auth hoặc tài khoản kết nối PostgreSQL. Mật khẩu được lưu dưới dạng
**Argon2id**. Backend đã có API đăng nhập; UI vẫn là trang starter, chưa có màn hình
đăng nhập. Có thể sử dụng các tài khoản sau qua Swagger hoặc API client.

| Email | Mật khẩu demo | Nhóm | Trạng thái |
|---|---|---|---|
| `quanly@agentra.demo` | `AgentraDemo!2026#QL` | Quản lý | ACTIVE |
| `kinhdoanh@agentra.demo` | `AgentraDemo!2026#KD` | Kinh doanh | ACTIVE |
| `kho@agentra.demo` | `AgentraDemo!2026#KHO` | Kho | ACTIVE |
| `ketoan@agentra.demo` | `AgentraDemo!2026#KT` | Kế toán | ACTIVE |
| `kinhdoanh2@agentra.demo` | `AgentraDemo!2026#KD2` | Kinh doanh | ACTIVE |
| `kho2@agentra.demo` | `AgentraDemo!2026#KHO2` | Kho | ACTIVE |
| `ketoan2@agentra.demo` | `AgentraDemo!2026#KT2` | Kế toán | ACTIVE |
| `locked@agentra.demo` | `AgentraDemo!2026#LOCK` | Kinh doanh | LOCKED — kiểm thử từ chối đăng nhập |

`python -m app.db.verify --seeded` kiểm tra các hash mật khẩu mẫu, số liệu
ledger/cache/chứng từ và báo cáo. `--regression` chạy thêm 54 assertions/rejections
PostgreSQL trong schema kiểm thử riêng rồi rollback toàn bộ fixture.

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
