# Đơn giản hóa nghiệp vụ DMS — 14/11/2026

Kế hoạch sở hữu cho đợt đơn giản hóa backend + frontend theo yêu cầu người dùng ngày
14/11/2026. Đặc tả gốc và các quyết định đã chốt nằm trong
`tmp/HANDOFF-don-gian-hoa-backend-frontend.md` (mục 1–9) và phần tiếp tục
`tmp/HANDOFF-don-gian-hoa-tiep-tuc.md`. Bằng chứng kiểm tra thật ở
[VERIFICATION.md](VERIFICATION.md).

## 1. Mục tiêu

Thu gọn ứng dụng về đúng nghiệp vụ quản lý đại lý của đồ án: tiếp nhận đại lý, nhập
hàng, xuất hàng, thu tiền (tiền mặt, chuyển khoản, VNPAY sandbox), hủy/sửa có lý do,
báo cáo doanh số và công nợ tháng, lịch sử chứng từ và nhật ký. Các luồng phức tạp
(trả trước, hoàn tiền, dư có, sổ phải thu FIFO, kiểm kê, trả hàng, điều chỉnh kho,
phiên bản chứng từ, idempotency key) được **bỏ theo yêu cầu 14/11/2026**; lịch sử kế
hoạch của chúng vẫn giữ trong các thư mục plan cũ.

## 2. Mô hình mới

| Khái niệm | Quy tắc |
|---|---|
| Chứng từ | 3 loại: `STOCK_RECEIPT` (PN), `STOCK_ISSUE` (PX), `PAYMENT_RECEIPT` (PT); trạng thái `DRAFT → POSTED → CANCELLED` |
| Nháp | Sửa/xóa tự do; ghi sổ mới thay đổi tồn kho/nợ |
| Hủy | Cần lý do (`REASON_REQUIRED`), chỉ chứng từ ngày trong tháng hiện tại (`PERIOD_CLOSED`) |
| Sửa | = hủy + chứng từ thay thế (`replacesDocumentId`) trong cùng giao dịch; lỗi thì chứng từ cũ vẫn POSTED |
| Số dư | `agency.debt`, `product.stock`, `product."lastPurchasePrice"` chỉ đổi trong `posting_context()` |
| Giá bán | `round(lastPurchasePrice × sellingPriceRate)`; chưa có giá nhập → `PRODUCT_NOT_PRICED` |
| QĐ1 | Tối đa `maxAgenciesPerWard` đại lý đang hoạt động / phường → `WARD_CAPACITY_EXCEEDED` |
| QĐ2–QĐ3 | Xuất không vượt tồn (`INSUFFICIENT_STOCK`), nợ sau xuất không vượt hạn mức loại đại lý (`DEBT_LIMIT_EXCEEDED`) |
| QĐ4 | Thu tiền không vượt nợ hiện tại (`PAYMENT_EXCEEDS_DEBT`); nợ âm chỉ có thể do VNPAY về muộn |
| Chấm dứt đại lý | Thêm guard `AGENCY_HAS_DEBT` (409) khi còn nợ (lệch so với đặc tả gốc, ghi ở VERIFICATION) |
| VNPAY | Sandbox; IPN thành công tạo phiếu thu `ONLINE` đã ghi sổ; TxnRef lạ → `RspCode 01`; không hoàn tiền |
| Báo cáo | Doanh số (BM5.1), công nợ (BM5.2), xuất nhập tồn, doanh số mặt hàng, tiền thu; tính Σ trực tiếp trên chứng từ POSTED |

## 3. Cơ sở dữ liệu

- Revision `0011_simplified_schema` (`backend/alembic/sql/0011_simplified_schema.sql`):
  drop và dựng lại schema `dms` gồm 16 bảng, 22 mã chức năng, `dms.clock`/`dms.app_now()`,
  trigger bảo vệ số dư/trạng thái/lịch sử, chỉ mục `pg_trgm`. Downgrade bị chặn.
- Production **reset dữ liệu** theo quyết định D4 (bỏ cam kết giữ receipt774/411
  chứng từ cũ); có backup trước khi nâng cấp.
- Seed v2 (`backend/app/db/seed.py`, `seed_data.py`): mô phỏng theo thời gian từ
  01/06/2026 tới hôm trước ngày seed qua chính `DocumentService`, 11 tài khoản thật của
  nhóm, không dùng từ "mẫu/demo/test"; chạy lại chỉ kiểm tra.
- `app.db.verify --seeded --regression`: invariant số dư/chứng từ + 83 kiểm tra SQL
  regression trong schema riêng (rollback).

## 4. Backend

- Xóa module: agency_credit, credit_applications, document_corrections, inventory,
  receivables, refunds, sales_returns, settlement_core, stock_adjustments,
  stock_counts, upfront_payments; `app/common/commands.py`, `provider_commands.py`,
  `TransactionRunner`, `app/db/sql/seed_helpers.sql`.
- `DocumentService` (`app/modules/document_core/`) phục vụ cả 3 loại chứng từ (8 route
  mỗi loại) và chế độ `embedded=True` cho seed/VNPAY.
- Viết lại: online_payments, document_history (`/documents`, `/chain`, `/print`),
  reports (+ collections), dashboard, agencies/products (cột số dư mới).
- Hợp đồng runtime 90 operation: `openwiki/backend-design/API/openapi.json`, sinh bằng
  `uv run python -m scripts.gen_openapi` từ `backend/`.

## 5. Frontend

- Xóa feature: receivables, stock_counts, upfront_payments, inventory, agency_credit,
  refunds, sales_returns, stock_adjustments, credit_applications, document_corrections.
- Menu 18 mục; Portal chỉ còn route hợp lệ, deck yêu thích cũ trong localStorage tự lọc
  route đã bỏ; GUIDE viết lại theo luồng mới; `errors.ts` có các mã lỗi mới.
- 24 ngôn ngữ giữ nguyên; catalogue 23 locale đồng bộ với chuỗi mới, xóa khóa thừa.
- Đổi ngôn ngữ hiển thị màn chờ (splash) thay vì trang trắng (yêu cầu bổ sung 14/11).

## 6. Thứ tự và cổng hoàn thành

1. Backend: ruff check/format, toàn bộ pytest offline + integration, deployment smoke,
   `alembic check` sạch.
2. Frontend: lint, typecheck, test, format:check, build; e2e smoke trình duyệt.
3. Tài liệu (AGENTS, README, openwiki, kế hoạch này + VERIFICATION).
4. Thử trên database Neon tạm: upgrade + seed + verify, đi luồng 8.2 theo từng vai trò.
5. Chỉ khi tất cả xanh: backup → production upgrade/seed/verify → Docker local →
   Vercel production → kiểm tra sau deploy, quét từ cấm = 0.
6. Có kiểm tra đỏ: dừng, không đụng production.
