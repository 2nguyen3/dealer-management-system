# Agentra - Dealer Management System

> Đồ án môn Nhập môn Công nghệ Phần mềm  
> Trường Đại học Công nghệ Thông tin, ĐHQG-HCM

## Thành viên thực hiện

| STT | Họ và tên | MSSV | Vai trò |
|:---:|---|:---:|---|
| 1 | Nguyễn Trần Thảo Nguyên | 23521052 | Nhóm trưởng |
| 2 | Nguyễn Thúy Ngân | 23520996 | Thành viên |
| 3 | Nguyễn Hà Minh Tuấn | 23521718 | Thành viên |
| 4 | Huỳnh Gia Phúc | 24521376 | Thành viên |

**Giảng viên hướng dẫn:** TS. Đỗ Thị Thanh Tuyền

## Giới thiệu

Agentra là hệ thống quản lý đại lý (Dealer Management System) cho một công ty phân
phối hàng hóa. Hệ thống quản lý hồ sơ đại lý và mặt hàng, phiếu nhập kho, phiếu xuất
hàng cho đại lý, phiếu thu tiền (tiền mặt hoặc chuyển khoản qua VNPAY), công nợ đại lý,
tồn kho, báo cáo kinh doanh và phân quyền người dùng.

- Bản triển khai: https://agentra-dms.vercel.app (API docs: `/api/docs`)
- Công nghệ: FastAPI + SQLAlchemy + Alembic (Python 3.12), React 19 + TypeScript + Vite,
  PostgreSQL 18 (Neon, Singapore), Docker Compose, Vercel.
- Tài liệu: phân tích nghiệp vụ ở [openwiki/BA](openwiki/BA/), thiết kế CSDL ở
  [openwiki/database-design](openwiki/database-design/README.md), hợp đồng API ở
  [openapi.json](openwiki/backend-design/API/openapi.json).

## Cài đặt

Yêu cầu: Python 3.12, [uv](https://docs.astral.sh/uv/), Node.js 24 LTS và một cơ sở dữ
liệu PostgreSQL.

### Chạy local

1. Sao chép `backend/.env.example` thành `backend/.env`, điền `DB_HOST`, `DB_PORT`,
   `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE` và một `AUTH_SIGNING_KEY` ngẫu nhiên
   dài tối thiểu 32 byte. Không commit file `.env`.
2. Trong `backend/`:

   ```sh
   uv sync --frozen
   uv run alembic upgrade head        # tạo schema dms
   uv run python -m app.db.seed       # dữ liệu mẫu (chỉ chạy trên schema trống)
   uv run uvicorn app.main:create_app --factory --reload --no-proxy-headers
   ```

3. Ở terminal khác, trong `ui/`:

   ```sh
   npm ci
   npm run dev
   ```

Mở http://localhost:5173. API docs ở http://localhost:8000/api/docs. Kiểm tra cơ sở dữ
liệu bằng `uv run python -m app.db.verify --seeded --regression`.

### Docker

Từ thư mục gốc, sau khi đã có `backend/.env`:

```sh
docker compose build
docker compose --profile tools run --rm migrate    # chạy migration
docker compose up -d --wait
```

Giao diện ở http://localhost:8080, API docs ở http://localhost:8080/api/docs.

### Vercel

Dự án đã liên kết với Vercel (`vercel.json` dựng cả frontend và backend). Từ `backend/`
tải biến môi trường bằng `uv run python deploy_vercel_env.py --environment production`,
rồi từ thư mục gốc chạy `npx vercel deploy --prod`.

Chi tiết cấu hình: [backend/README.md](backend/README.md), [ui/README.md](ui/README.md).

## Hướng dẫn sử dụng

Đăng nhập bằng tài khoản được cấp (danh sách tài khoản dùng thử nằm trong
`openwiki/cred/account/account.md`). Menu bên trái chỉ hiện các chức năng mà nhóm
người dùng được phép dùng.

| Menu | Chức năng |
|---|---|
| Cổng quản lý | Trang chủ (Portal): ghim các chức năng hay dùng. |
| Bảng điều khiển | Dashboard doanh thu, công nợ, tồn kho. |
| Báo cáo kinh doanh | 5 báo cáo: doanh số, công nợ, tồn kho, doanh số theo mặt hàng, thu tiền; xuất Excel/PDF. |
| Hồ sơ đại lý | Tiếp nhận, sửa, ngừng hợp tác đại lý; xem công nợ hiện tại. |
| Danh mục mặt hàng | Mặt hàng, tồn kho và giá nhập gần nhất. |
| Phiếu nhập hàng (PN) | Nhập hàng vào kho; ghi sổ làm tăng tồn kho. |
| Phiếu xuất hàng (PX) | Xuất hàng cho đại lý; ghi sổ làm giảm tồn kho và tăng công nợ. |
| Phiếu thu tiền (PT) | Thu tiền mặt, hoặc chuyển khoản VNPAY: hệ thống tạo mã QR và phiếu báo thanh toán PDF, khi đại lý trả xong phiếu thu được ghi sổ tự động. Mọi phiếu thu đều xuất được PDF. |
| Thanh toán trực tuyến | Theo dõi giao dịch VNPAY (đang chờ, thành công, thất bại, hết hạn). |
| Danh mục & Quy định | Loại đại lý (hạn mức nợ), đơn vị tính, quy định (số đại lý tối đa mỗi phường, tỷ lệ giá bán). |
| Người dùng & Phân quyền | Tài khoản, nhóm người dùng và quyền theo chức năng. |
| Nhật ký hệ thống | Lịch sử thao tác của người dùng. |
| Lịch sử chứng từ | Tìm, xem, in chứng từ; hủy hoặc sửa chứng từ trong tháng hiện tại (bắt buộc ghi lý do). |

Quy trình chứng từ: **Nháp → Ghi sổ → Hủy**. Chỉ phiếu đã ghi sổ mới ảnh hưởng tồn kho
và công nợ. Mỗi trang có nút **GUIDE** giải thích cách dùng. Giao diện hỗ trợ 24 ngôn ngữ và
nhiều bảng màu sáng/tối, đổi trong trang Hồ sơ.
