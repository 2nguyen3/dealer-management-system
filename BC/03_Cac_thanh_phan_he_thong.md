# Các thành phần của hệ thống

Các thành phần dưới đây được xác định từ mã nguồn và cấu hình của Agentra. Bảng đầu trình bày các thành phần kỹ thuật; bảng tiếp theo trình bày các phân hệ nghiệp vụ. Hai cách phân chia bổ sung cho nhau, không thể hiện hai hệ thống độc lập.

## 1. Thành phần kỹ thuật

| STT | Thành phần | Diễn giải ngắn gọn |
|---|---|---|
| 1 | Trình duyệt người dùng | Chạy giao diện web và tiếp nhận thao tác của người dùng; không truy cập trực tiếp cơ sở dữ liệu. |
| 2 | Giao diện React và TypeScript | Hiển thị màn hình, biểu mẫu, bảng dữ liệu, dashboard và kết quả nghiệp vụ dưới dạng SPA. |
| 3 | Điều hướng và bố cục ứng dụng | React Router, shell và menu tổ chức màn hình; kiểm soát truy cập giao diện theo trạng thái đăng nhập và quyền. |
| 4 | API client phía frontend | Gửi HTTP bằng `fetch`, đính kèm token/header điều kiện/khóa thao tác, xử lý lỗi và hủy yêu cầu khi cần. |
| 5 | Nginx | Phục vụ tài nguyên frontend đã build và chuyển tiếp `/api/` đến backend. |
| 6 | FastAPI và Uvicorn | Tiếp nhận HTTP và vận hành ứng dụng API; cung cấp các endpoint nghiệp vụ và health check. |
| 7 | Router, schema và dependency | Định nghĩa endpoint, kiểm tra dữ liệu đầu vào và thực hiện các kiểm tra truy cập trước khi gọi nghiệp vụ. |
| 8 | Service nghiệp vụ | Kiểm tra quy tắc, điều phối thao tác giữa các module và quản lý việc hoàn tất giao dịch. |
| 9 | Repository và SQLAlchemy | Đọc, ghi, truy vấn và khóa dữ liệu bằng ORM/SQL; một số câu lệnh SQLAlchemy cũng được thực hiện tại service. |
| 10 | psycopg 3 và phiên kết nối | Trình điều khiển PostgreSQL; kết hợp phiên SQLAlchemy đồng bộ và pool kết nối backend. |
| 11 | PostgreSQL trên Supabase | Lưu dữ liệu tập trung trong schema `dms`; cung cấp bảng, ràng buộc, trigger, hàm và view. |
| 12 | Xác thực và phân quyền | Quản lý tài khoản, nhóm quyền, JWT, refresh token và thu hồi phiên; backend quyết định quyền truy cập cuối cùng. |
| 13 | Hạ tầng giao dịch và chống xử lý lặp | Quản lý commit/rollback, điều kiện phiên bản, command idempotency và retry có giới hạn. |
| 14 | Logging và audit | Log kỹ thuật hỗ trợ chẩn đoán; audit dữ liệu hỗ trợ truy vết thay đổi và người thực hiện. |
| 15 | VNPAY sandbox | Dịch vụ ngoài phục vụ checkout, thông báo IPN, truy vấn và yêu cầu hoàn tiền; không đồng nghĩa triển khai production. |
| 16 | SMTP | Gửi email đặt lại mật khẩu khi có cấu hình vận hành hợp lệ. |
| 17 | Alembic và SQL migration | Quản lý phiên bản cấu trúc database; chạy riêng, không tự thay đổi schema mỗi lần API khởi động. |
| 18 | Docker Compose | Định nghĩa cách xây dựng và kết nối frontend, backend và job migration; PostgreSQL vẫn là dịch vụ bên ngoài. |
| 19 | Vite và công cụ kiểm tra | Vite biên dịch giao diện; TypeScript, ESLint, Vitest/Playwright, Ruff/pytest hỗ trợ kiểm tra mã và hành vi. |

## 2. Phân hệ nghiệp vụ

| STT | Thành phần | Diễn giải ngắn gọn |
|---|---|---|
| 1 | Xác thực người dùng | Đăng nhập, đăng xuất, làm mới phiên, đổi mật khẩu và đặt lại mật khẩu. |
| 2 | Quản trị người dùng và nhóm | Quản lý tài khoản, trạng thái, nhóm và quyền sử dụng chức năng. |
| 3 | Danh mục và quy định | Quản lý quận, loại đại lý, đơn vị tính và quy định dùng chung. |
| 4 | Quản lý đại lý | Lưu hồ sơ, thông tin phân loại và trạng thái hợp tác của đại lý. |
| 5 | Quản lý mặt hàng | Quản lý thông tin hàng hóa, đơn vị tính, trạng thái và thông tin giá theo chính sách. |
| 6 | Nền tảng chứng từ | Quản lý chứng từ, phiên bản, dòng chi tiết, lịch sử và thông tin ghi sổ dùng chung. |
| 7 | Nhập hàng | Lập phiếu nhập và ghi nhận hàng vào kho khi phiếu được ghi sổ hợp lệ. |
| 8 | Xuất hàng và trả ngay | Lập phiếu xuất; kiểm tra tồn, điều kiện công nợ hoặc bằng chứng trả ngay trước khi hoàn tất nghiệp vụ. |
| 9 | Tồn kho, điều chỉnh và kiểm kê | Theo dõi biến động kho, số tồn, kiểm kê và xử lý chênh lệch theo chứng từ. |
| 10 | Thu tiền và công nợ | Quản lý phiếu thu, số phải thu và phân bổ thanh toán vào nghĩa vụ nợ. |
| 11 | Trả hàng | Ghi nhận hàng trả có nguồn gốc và điều chỉnh tác động kho/tài chính theo tình trạng giao dịch. |
| 12 | Dư có và bù trừ | Theo dõi tiền/dư có của đại lý, nguồn hình thành và việc dùng dư có để thanh toán công nợ. |
| 13 | Thanh toán và hoàn tiền online | Quản lý giao dịch cổng thanh toán, đối soát bằng chứng, yêu cầu hoàn và trạng thái xử lý. |
| 14 | Sửa sai và hủy chứng từ | Điều chỉnh hoặc hủy theo trạng thái và quyền; bảo toàn lịch sử bằng phiên bản và bút toán phù hợp. |
| 15 | Dashboard và báo cáo | Cung cấp tổng quan theo quyền, báo cáo theo kỳ/bộ lọc và xuất dữ liệu theo định dạng hỗ trợ. |
| 16 | Nhật ký kiểm toán | Tra cứu lịch sử thay đổi dữ liệu phục vụ kiểm soát và truy vết. |

**Phần chưa khả dụng:** trợ lý AI/chatbot mới có màn hình thông báo, chưa có backend xử lý hỏi đáp được công bố trong router. Không tính đây là một phân hệ đã hoạt động đầy đủ.

## 3. Căn cứ đối chiếu

- `ui/src/app/App.tsx` và `ui/src/app/navigation.ts`: màn hình và điều hướng hiện có.
- `ui/package.json`: các công nghệ và công cụ frontend.
- `backend/app/api/router.py`: các module API được ghép vào ứng dụng.
- `backend/app/modules/`: hiện thực nghiệp vụ và truy cập dữ liệu.
- `backend/app/core/`, `backend/app/common/`, `backend/app/db/`: hạ tầng dùng chung.
- `compose.yaml`, `ui/nginx.conf`: các thành phần triển khai và proxy.
- `backend/alembic/sql/`: đối tượng và cơ chế bảo vệ dữ liệu ở PostgreSQL.

Các đường dẫn tính từ gốc repository. Bảng phản ánh thành phần có trong mã nguồn được đối chiếu ngày 06/11/2026, không phải biên bản nghiệm thu toàn bộ chức năng hoặc xác nhận các dịch vụ ngoài đang sẵn sàng.
