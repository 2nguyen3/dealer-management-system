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

| Component | Stack | Documentation |
|---|---|---|
| API | Python 3.12, FastAPI, SQLAlchemy, Alembic | [Backend setup](backend/README.md) |
| Database | Supabase-hosted PostgreSQL | [Connection configuration](backend/README.md#supabase-connection) |
| Frontend | React, Vite, TypeScript | [Frontend setup](ui/README.md) |
| Deployment | Docker Compose, unprivileged Nginx | See below |

### Run locally

Prerequisites: Python 3.12, uv, Node.js 24 LTS, and a Supabase project.

1. Copy `backend/.env.example` to `backend/.env`, verify the Supabase `DB_HOST`,
   `DB_PORT`, `DB_NAME`, and `DB_USER`, and fill in `DB_PASSWORD`.
2. In `backend/`, run:

   ```sh
   uv sync --frozen
   uv run alembic upgrade head
   uv run python -m app.db.seed
   uv run uvicorn app.main:create_app --factory --reload
   ```

3. In a second terminal, in `ui/`, run:

   ```sh
   npm ci
   npm run dev
   ```

Open http://localhost:5173. API docs are at http://localhost:8000/api/docs.
Environment files are ignored by Git; commit only the example templates.

### Database và dữ liệu demo

Schema `dms` đã được triển khai lên Supabase bằng Alembic, revision hiện tại
`0002`. Thiết kế ở [openwiki/database-design](openwiki/database-design/README.md);
DDL có version nằm trong `backend/alembic/sql/`. Migration tạo đầy đủ 29 bảng,
3 domain số chính xác, sequence, FK/CHECK/index, trigger toàn vẹn/audit,
5 view và các hàm báo cáo; revision `0002` thêm index tìm kiếm `pg_trgm`.

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
**Argon2id**. Backend/UI hiện chưa triển khai API hay màn hình đăng nhập; bảng
dưới đây cung cấp thông tin để sử dụng khi tích hợp authentication.

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

### Docker deployment

Prerequisites: Docker Engine/Desktop with Compose v2 and a configured
`backend/.env`. Supabase remains an external managed database.

From the repository root:

```sh
docker compose build
docker compose --profile tools run --rm migrate
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

Compose defines the following runtime settings:

- Backend health checks call `/api/v1/health/ready`, including database connectivity,
  every 30 seconds. The frontend starts after the backend is healthy, so valid
  `DB_*` settings and a reachable Supabase database are required.
- Frontend health checks call Nginx `/healthz` every 30 seconds.
- The one-off migration service has HTTP health checks disabled.
- All services use the `app` bridge network, with outbound access to Supabase.
- Container logs rotate at 10 MB, keeping three files per container.
- Graceful shutdown allows 30 seconds for the backend/migrations and 15 for Nginx.
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
for reproducible installs. The scaffold contains infrastructure and a starter
screen; domain tables and business workflows can be added incrementally.
