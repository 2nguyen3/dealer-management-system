# Agentra DMS - Frontend Implementation & Session Handoff

**Vị trí tài liệu:** `openwiki/frontend-design/HANDOFF.md`  
**Ngày cập nhật:** 2026-10-23  
**Dự án:** Agentra — Hệ thống Quản lý Đại lý (DMS)  
**Môi trường:** Docker Compose (Nginx Frontend `:8080`, FastAPI Backend `:8000`, Supabase PostgreSQL)  

---

## 1. Tóm tắt trạng thái hiện tại (Current Status)

Hệ thống Frontend (`ui/`) đã **hoàn thành 100% toàn bộ 32/32 Modules giao diện (F01 – F32)** theo đúng hợp đồng thiết kế OpenAPI mục tiêu (`openwiki/backend-design/API/openapi.json`) và 140 wireframes (`openwiki/frontend-design/wr/`).

### Toàn bộ 32 Module đã hoàn thành (Completed Scope):

1. **F01 — Frontend Foundations & Transport (`src/lib/`):**
   - Bộ client `apiFetch` an toàn, bắt lỗi có cấu trúc `ApiError`, quản lý ETag (`If-Match`), AbortController cho request hủy tự động.
   - Thư viện `formatters.ts`: Định dạng tiền tệ VND (`formatVND`), số lượng (`formatQuantity`), ngày tháng (`formatDate`, `formatDateTime`) bảo toàn chuỗi số chính xác (không ép kiểu qua JavaScript `Number` để tránh mất độ chính xác).
   - Hệ thống UI components dùng chung tại `src/components/ui/`: `Button`, `Input`, `Select`, `Modal`, `Badge`, `Alert`, `Spinner`, `EmptyState`, `Table`, `Pagination`, `Icons`.
2. **F02 — Authentication & Session Coordination (`src/features/authentication/`):**
   - Màn hình Đăng nhập (`/login`) tiếng Việt, responsive, có toggle ẩn/hiện mật khẩu, thông báo lỗi cụ thể (sai mật khẩu, tài khoản bị khóa, quá giới hạn, mất mạng).
   - Quên mật khẩu (`/forgot-password`) và Đặt lại mật khẩu (`/reset-password`).
   - Đổi mật khẩu (`ChangePasswordModal`).
   - Chính sách Session: Access token lưu trong bộ nhớ (RAM); Refresh token lưu trong `sessionStorage` gắn kèm `tabId` để chống race-condition khi duplicate tab; tự động silent refresh khi nhận 401; dọn sạch phiên và abort pending request khi đăng xuất.
3. **F03 — Application Shell & Phân quyền (`src/app/`):**
   - Khung giao diện `ShellLayout` với thanh tiêu đề, menu tài khoản, sidebar điều hướng responsive.
   - `ProtectedRoute`: Chặn truy cập trái phép bằng `hasPermission` dựa trên `allowedFunctions` thực tế từ API `/auth/me`.
   - Trang báo lỗi quyền hạn (`/access-denied`) và không tìm thấy (`/404`).
4. **Các màn hình danh mục & nghiệp vụ cốt lõi (F04 – F24):**
   - **Đại lý (`/agencies`)**: Tiếp nhận đại lý mới, sửa hồ sơ, ngừng hợp tác (`terminate`), lọc theo quận, loại đại lý, trạng thái.
   - **Mặt hàng (`/products`)**: Danh mục hàng hóa, đơn giá nhập/xuất, cảnh báo tồn kho, ngừng kinh doanh.
   - **Quận (`/districts`)**: Quản lý địa bàn, sức chứa đại lý.
   - **Loại đại lý (`/agency-types`)**: Thiết lập loại đại lý và hạn mức nợ tối đa.
   - **Đơn vị tính (`/units`)**: Danh mục đơn vị tính, chính sách cho phép số thập phân.
   - **Quy định (`/business-rules`)**: Cấu hình các tham số toàn hệ thống (QĐ1, QĐ2, QĐ4, QĐ5).
   - **Tài khoản (`/users`)**: Tạo người dùng, phân nhóm, khóa/mở khóa, reset mật khẩu.
   - **Nhóm quyền (`/user-groups`)**: Tạo và chỉnh sửa nhóm vai trò.
   - **Phân quyền chức năng (`/permissions`)**: Ma trận bật/tắt quyền theo từng nhóm người dùng với ETag concurrency.
   - **Nhật ký hệ thống (`/audit-logs`)**: Tra cứu lịch sử thao tác, đối tượng và thay đổi chi tiết.
   - **Phiếu nhập hàng (`/stock-receipts`)**: Lập phiếu nhập nhiều dòng, ghi sổ kho.
   - **Phiếu xuất hàng (`/stock-issues`)**: Lập phiếu xuất, nộp duyệt, ghi nhận công nợ.
   - **Phiếu thu tiền (`/payment-receipts`)**: Thu nợ đại lý phân bổ theo FIFO hóa đơn.
   - **Xác nhận trả ngay (`/upfront-payments`)**: Kế toán xác minh tiền trả ngay trước khi xuất hàng.
   - **Công nợ (`/receivables`)**: Tổng quan công nợ đại lý, xem chi tiết từng hóa đơn chưa thanh toán.
   - **Tồn kho & Thẻ kho (`/inventory`)**: Sổ biến động chi tiết nhập xuất tồn theo từng mặt hàng.
   - **Điều chỉnh kho (`/stock-adjustments`)**: Biên bản tăng/giảm tồn kho.
   - **Kiểm kê kho (`/stock-counts`)**: Biên bản kiểm kê thực tế đối chiếu sổ sách.
   - **Phiếu trả hàng (`/sales-returns`)**: Ghi nhận nhận lại hàng từ đại lý.
   - **Dư có đại lý (`/agency-credit`)**: Chọn đại lý xem các lô dư có (`credit-lots`), số tiền còn lại và khả dụng.
5. **8 module nghiệp vụ & tiện ích mở rộng vừa hoàn thiện (F25 – F32):**
   - **F25 — Bù trừ dư có (`/credit-applications`)**: Lập phiếu cấn trừ nợ bằng số dư có khả dụng, tự động đề xuất số tiền bù trừ tối đa theo nợ hiện tại, phân bổ FIFO hóa đơn xuất, nộp duyệt ghi sổ và hủy phiếu.
   - **F26 — Thanh toán trực tuyến (`/online-payments`)**: Khởi tạo link/QR thanh toán nợ đại lý qua cổng thanh toán (Sandbox, VNPay, MoMo, VietQR), mở trang thanh toán, theo dõi sự kiện Webhook callback và đối soát giao dịch tự động.
   - **F27 — Hoàn tiền đại lý (`/refunds`)**: Lập yêu cầu hoàn trả tiền mặt, chuyển khoản hoặc online từ số tiền dư có của đại lý, theo dõi trạng thái giữ chỗ quỹ (`reservedAmount`), xác nhận đã chi tiền và quản lý các lần thử trực tuyến.
   - **F28 — Lịch sử chứng từ (`/document-history`)**: Tra cứu liên loại toàn bộ chứng từ hệ thống, xem chi tiết từng phiên bản sửa đổi (Revisions), bảng kê mặt hàng của phiên bản, xem và in phiếu chứng từ chuẩn mực (`window.print()`).
   - **F29 — Sửa sai & Hủy chứng từ (`/document-corrections`)**: Giao diện điều chỉnh và hủy bỏ các chứng từ đã ghi sổ (Posted) kèm nhập lý do bắt buộc và cảnh báo cơ chế Replay tái tính toán dòng tiền và tồn kho.
   - **F30 — Báo cáo kinh doanh (`/reports`)**: Trung tâm báo cáo kinh doanh tổng hợp: Báo cáo doanh số tháng đại lý (BM6.1), Báo cáo công nợ đại lý (BM6.2), Báo cáo xuất nhập tồn kho hàng hóa, bộ lọc linh hoạt theo tháng/năm và in báo cáo.
   - **F31 — Bảng điều khiển (`/dashboard`)**: Dashboard tổng quan theo phân quyền người dùng (Kinh doanh, Kho, Kế toán, Quản lý): thẻ chỉ số KPI kỳ, biểu đồ Top đại lý nợ cao nhất, mặt hàng chạm ngưỡng tồn tối thiểu và phiếu xuất gần đây.
   - **F32 — Trợ lý ảo Chatbot (`/chatbot`)**: Giao diện hỏi đáp ngôn ngữ tự nhiên tra cứu thông minh công nợ đại lý, tồn kho sản phẩm và tổng doanh số, hỗ trợ gợi ý nhanh, tự động xử lý và đề xuất chọn đại lý khi trùng tên.

---

## 2. Kết quả kiểm chứng toàn diện (Verification Passed)

Tất cả các lệnh kiểm tra chất lượng từ thư mục `ui/` đều đạt **100%**:

```sh
npm run typecheck    # PASS: TypeScript 5.9 strict type checking (0 errors)
npm run lint         # PASS: ESLint 9 với 0 error, 0 warning
npm run format:check # PASS: Prettier formatting chuẩn xác 100%
npm run build        # PASS: Vite production build thành công (dist/assets/...)
npm test             # PASS: Toàn bộ 16 test suites, 62/62 tests pass (bao gồm cả Live Docker Integration test qua Nginx :8080)
```

Tài sản build mới nhất đã được đồng bộ vào container Docker đang chạy:
```sh
docker cp dist/. dms-frontend-1:/usr/share/nginx/html
```

---

## 3. Bản đồ định tuyến & Menu hệ thống (Navigation Map)

| Nhóm menu | Tên màn hình | Đường dẫn | Quyền yêu cầu |
| :--- | :--- | :--- | :--- |
| **Tổng quan** | Bàn làm việc chính | `/` | Authenticated |
| **Báo cáo & Thống kê** | Bảng điều khiển | `/dashboard` | Authenticated |
| | Báo cáo kinh doanh (BM6.1, BM6.2) | `/reports` | `reports.read`, `sales.read`, `debt.read`, `inventory.read` |
| | Trợ lý ảo Chatbot | `/chatbot` | Authenticated |
| **Đại lý** | Hồ sơ đại lý | `/agencies` | `agency.read` |
| | Hạn mức & Dư có | `/agency-credit` | `agency.read` |
| **Kho & Hàng hóa** | Danh mục mặt hàng | `/products` | `product.manage` |
| | Phiếu nhập hàng | `/stock-receipts` | `stock.receipt.prepare`, `stock.receipt.post` |
| | Phiếu xuất hàng | `/stock-issues` | `stock.issue.prepare`, `stock.issue.post` |
| | Tồn kho & Thẻ kho | `/inventory` | `inventory.read` |
| | Điều chỉnh kho | `/stock-adjustments` | `stock.adjustment.prepare`, `stock.adjustment.post` |
| | Kiểm kê kho | `/stock-counts` | `stock.count` |
| **Thu tiền & Công nợ** | Phiếu thu tiền | `/payment-receipts` | `cash.receipt.prepare`, `cash.receipt.post` |
| | Thanh toán trực tuyến | `/online-payments` | `payments.online`, `debt.read` |
| | Xác nhận trả ngay | `/upfront-payments` | `cash.upfront.verify` |
| | Công nợ đại lý | `/receivables` | `debt.read` |
| | Phiếu trả hàng | `/sales-returns` | `returns.prepare`, `returns.post` |
| | Bù trừ dư có | `/credit-applications` | `credit.apply`, `debt.read` |
| | Hoàn tiền đại lý | `/refunds` | `cash.refund.prepare`, `cash.refund.post`, `debt.read` |
| **Danh mục & Quy định** | Danh sách quận | `/districts` | `district.manage` |
| | Loại đại lý | `/agency-types` | `agency_type.manage` |
| | Đơn vị tính | `/units` | `unit.manage` |
| | Thay đổi quy định | `/business-rules` | `rules.manage` |
| **Quản trị hệ thống** | Tài khoản người dùng | `/users` | `users.manage` |
| | Nhóm người dùng | `/user-groups` | `groups.manage` |
| | Phân quyền chức năng | `/permissions` | `permissions.manage` |
| | Nhật ký hệ thống | `/audit-logs` | `audit.read` |
| | Lịch sử chứng từ | `/document-history` | Authenticated |
| | Sửa sai & Hủy chứng từ | `/document-corrections` | `documents.correct`, `documents.cancel` |

---

## 4. Tài khoản Demo kiểm thử

- **Quản lý:** `quanly@agentra.demo` / `AgentraDemo!2026#QL` (toàn quyền quản trị, báo cáo, dashboard)
- **Kinh doanh:** `kinhdoanh@agentra.demo` / `AgentraDemo!2026#KD` (đại lý, xuất hàng, doanh số)
- **Kho:** `kho@agentra.demo` / `AgentraDemo!2026#KHO` (nhập hàng, thẻ kho, kiểm kê, điều chỉnh)
- **Kế toán:** `ketoan@agentra.demo` / `AgentraDemo!2026#KT` (thu tiền, công nợ, trả ngay, bù trừ, hoàn tiền)
- **Tài khoản khóa:** `locked@agentra.demo` / `AgentraDemo!2026#LOCK` (kiểm tra từ chối đăng nhập)

---

## 5. Kết quả điều tra hiệu năng & Tối ưu hóa UI (Performance Upgrade)

### 5.1. Nguyên nhân độ trễ (Root Cause Investigation):
1. **Độ trễ địa lý mạng (Geographic RTT)**: Cơ sở dữ liệu Supabase được host tại khu vực Sydney, Australia (`aws-0-ap-southeast-2.pooler.supabase.com`). Độ trễ mạng cơ sở (RTT) từ Việt Nam sang Sydney là ~250ms/round-trip.
2. **Khởi tạo kết nối mỗi request (`NullPool`)**: Trong `session.py`, `NullPool` bắt buộc mỗi request HTTP mở một kết nối TCP + TLS mới (tốn 1.5 – 2.5s) trước khi truy vấn.
3. **Truy vấn phân quyền tuần tự**: Mỗi request cần 2 truy vấn auth (`dms.app_user` và `dms.user_group_permission`) + truy vấn nghiệp vụ. Mặc dù PostgreSQL thực thi cực nhanh (< 0.1ms), mạng viễn thông quốc tế làm thời gian phản hồi API đạt 3.3s – 4.6s.

### 5.2. Giải pháp nâng cao hiệu năng Frontend UI (Instant Response):
1. **Bộ nhớ đệm SWR đa tầng (`src/lib/cache.ts`)**:
   - Tầng 1 (RAM 0ms) + Tầng 2 (`sessionStorage` bảo toàn qua các lần tải lại trang).
   - Cơ chế Stale-While-Revalidate: Trả kết quả có sẵn trong bộ nhớ **ngay tức thì (0ms)** và âm thầm cập nhật dữ liệu mới ở background.
2. **Khởi tạo trạng thái tức thì (`getCachedData`)**:
   - Các màn hình nghiệp vụ (`AgenciesPage`, `ProductsPage`, `ReceivablesPage`, `StockIssuesPage`, `StockReceiptsPage`, `PaymentReceiptsPage`, `DashboardPage`,...) nạp dữ liệu từ cache ngay trong hàm khởi tạo `useState`, loại bỏ hoàn toàn màn hình xoay spinner 4 giây khi chuyển trang.
3. **Tải trước danh mục dùng chung (`prefetchMasterData`)**:
   - Ngay khi đăng nhập thành công, hệ thống tự động tải ngầm 6 danh mục cốt lõi (`/agencies`, `/products`, `/districts`, `/agency-types`, `/units`, `/business-rules`). Khi người dùng mở bất kỳ chức năng nào, toàn bộ dropdown và danh mục đã sẵn sàng.
4. **Phân tách gói bundle (Vite Code Splitting)**:
   - Tách thư viện bên thứ ba (`vendor.js`: React, React Router) khỏi mã ứng dụng, giảm kích thước chunk chính từ 527kB xuống 268kB, tối ưu hóa tốc độ biên dịch và tận dụng bộ nhớ đệm vĩnh viễn của trình duyệt.

