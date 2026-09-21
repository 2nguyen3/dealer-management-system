# Dealer Management System

> Đồ án môn Nhập môn Công nghệ Phần mềm  
> Trường Đại học Công nghệ Thông tin, ĐHQG-HCM

## Giới thiệu

Dealer Management System là hệ thống hỗ trợ quản lý hoạt động phân phối hàng hóa cho các đại lý.

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
   uv run uvicorn app.main:create_app --factory --reload
   ```

3. In a second terminal, in `ui/`, run:

   ```sh
   npm ci
   npm run dev
   ```

Open http://localhost:5173. API docs are at http://localhost:8000/api/docs.
Environment files are ignored by Git; commit only the example templates.

### Docker deployment

Prerequisites: Docker Engine/Desktop with Compose v2 and a configured
`backend/.env`. Supabase remains an external managed database.

From the repository root:

```sh
docker compose build
docker compose --profile tools run --rm migrate
docker compose up -d
docker compose ps
```

- Application: http://localhost:8080
- API docs: http://localhost:8080/api/docs
- Database readiness: http://localhost:8080/api/v1/health/ready

Only the frontend port is published. Nginx forwards `/api/` requests to FastAPI
over the internal Docker network. Both containers run as non-root users and
have health checks. Set `WEB_PORT` in your shell (or a root `.env`) to change
the default 8080 port. For an internet deployment, terminate HTTPS at your
hosting platform's ingress or reverse proxy.

```sh
docker compose logs -f
docker compose down
```

Dependency lockfiles (`backend/uv.lock` and `ui/package-lock.json`) are included
for reproducible installs. The scaffold contains infrastructure and a starter
screen; domain tables and business workflows can be added incrementally.
