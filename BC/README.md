# Bộ tài liệu báo cáo Agentra

Ngày đối chiếu mã nguồn: **06/11/2026**. Bộ tài liệu này phục vụ phần kiến trúc, quá trình hoạt động, thành phần và thiết kế cơ sở dữ liệu của báo cáo. Không thay đổi chương trình hoặc database đang chạy.

## 1. Nội dung bàn giao

| Tệp | Mục đích |
|---|---|
| [01_Kien_truc_he_thong.md](01_Kien_truc_he_thong.md) | Mô hình client–server ba tầng; tổ chức backend modular monolith, các phần nội bộ và triển khai. |
| [02_Qua_trinh_hoat_dong.md](02_Qua_trinh_hoat_dong.md) | Luồng đăng nhập, đọc/ghi dữ liệu, chứng từ, thanh toán, báo cáo và xử lý lỗi. |
| [03_Cac_thanh_phan_he_thong.md](03_Cac_thanh_phan_he_thong.md) | Hai bảng STT, thành phần, diễn giải ngắn gọn cho kỹ thuật và nghiệp vụ. |
| [04_Mo_ta_co_so_du_lieu.md](04_Mo_ta_co_so_du_lieu.md) | Mô tả đủ 30 bảng theo nhóm, cột, khóa, quan hệ và quy tắc dữ liệu chính. |
| [05_Ket_qua_doi_chieu_database.md](05_Ket_qua_doi_chieu_database.md) | Chuỗi migration, sai khác của DBML gốc, hiệu chỉnh và giới hạn xác minh. |
| [Database/DMS.dbml](Database/DMS.dbml) | Code DBML hoàn chỉnh để dựng ERD trong dbdiagram. |
| [So_do/Kien_truc_he_thong.drawio](So_do/Kien_truc_he_thong.drawio) | Sơ đồ kiến trúc trắng đen dạng XML, có các khối và đường nối chỉnh sửa được. |
| [So_do/Kien_truc_he_thong.svg](So_do/Kien_truc_he_thong.svg) | Hình vector kiến trúc, nền trắng, nét/chữ đen. |
| [So_do/Kien_truc_he_thong.png](So_do/Kien_truc_he_thong.png) | Hình kiến trúc 3200 × 2400 pixel để chèn báo cáo. |
| [Prompts/Kien_truc_he_thong.txt](Prompts/Kien_truc_he_thong.txt) | Prompt tạo hình kiến trúc theo đúng các thành phần hệ thống. |
| [Prompts/Tong_quan_database.txt](Prompts/Tong_quan_database.txt) | Prompt hình tổng quan database; không thay ERD chi tiết từ DBML. |
| [So_do/export-diagrams.mjs](So_do/export-diagrams.mjs) | Mã tái tạo draw.io/SVG/PNG từ cùng một bộ tọa độ và kiểm tra hình học chữ. |

## 2. Dùng sơ đồ

**draw.io:** mở diagrams.net, chọn **File → Open From → Device** và chọn `So_do/Kien_truc_he_thong.drawio`. Đây là tệp XML không nén, không cần chuyển đổi Mermaid hoặc ảnh trước. Các khối và đường nối là đối tượng riêng để chỉnh sửa. PNG/SVG là bản xuất sẵn; có thể dùng trực tiếp trong báo cáo.

**dbdiagram:** tạo diagram và đưa nội dung `Database/DMS.dbml` vào trình soạn thảo DBML; chọn chế độ nhập DBML nếu giao diện có cung cấp. File chứa toàn bộ bảng và `Ref`, không phải SQL để dán vào chế độ import SQL. Bản này có 8 nhóm bảng; khi xuất ERD chi tiết nhiều cột, nên dùng khổ lớn hoặc chia hình theo nhóm để nhãn vẫn đọc được.

Prompt tạo ảnh là đầu vào cho công cụ sinh ảnh, không phải ảnh được sinh bằng AI. Hình kiến trúc bàn giao được dựng bằng mã để giữ chính xác nhãn và đường nối. Đối với database, dùng DBML để có sơ đồ quan hệ chính xác; prompt chỉ phục vụ hình tổng quan khái niệm.

## 3. Database có phải mới nhất không?

**Bản trong `BC/Database/DMS.dbml` đã được đối chiếu với schema nguồn đến migration `0009`.** Có 30 bảng, 293 cột và 64 FK. DBML gốc đã khớp cấu trúc bảng/cột/quan hệ, nhưng còn sai khác về mô tả partial unique của phiên đăng nhập và thiếu một số CHECK/index/ghi chú. Bản bàn giao đã hiệu chỉnh các điểm đã xác minh, không sửa bản gốc trong `openwiki/`.

Không khẳng định một diagram đã lưu trên tài khoản dbdiagram của bạn được tự động cập nhật; lần làm này chỉ tạo bản file trong workspace. Cũng không xác nhận revision của database live vì không kết nối Supabase trong đợt lập báo cáo.

## 4. Kiểm tra đầu ra

- Đối chiếu tĩnh bảng/cột/PK/FK với chuỗi SQL migration `0001..0009`; chi tiết và giới hạn ở tài liệu 05.
- `@dbml/cli` 11.0.1 parse và xuất PostgreSQL SQL thành công. SQL kiểm tra nằm ngoài repository, không được thực thi hay dùng thay migration.
- `node BC/So_do/export-diagrams.mjs` xuất SVG, XML draw.io và PNG; kiểm tra XML hợp lệ, 23 vertex, 8 edge, ID không trùng, đầu mút tồn tại và chữ SVG không vượt khung/canvas: không có lỗi.
- PNG được xuất bằng Playwright với Microsoft Edge cài sẵn. Không cài trình duyệt mới hoặc khởi động backend/frontend để tạo hình.
- Kiểm tra toàn bộ 13 tệp bàn giao: 22 liên kết tương đối tồn tại, không có ký tự Unicode lỗi hoặc khoảng trắng cuối dòng; PNG đúng 3200 × 2400 pixel; DBML có 30 khai báo bảng và 64 Ref.
- Phiên công cụ không hỗ trợ đọc ảnh để đánh giá trực quan; **chưa xác nhận bằng mắt hoặc mở trong UI draw.io/dbdiagram**. Kiểm tra tự động không thay thế hoàn toàn việc kiểm tra nhãn/mũi tên sau khi dàn trang báo cáo.

Tái tạo hình từ gốc repository bằng `node BC/So_do/export-diagrams.mjs`. Script dùng Playwright đã có trong `ui/node_modules` và mặc định kênh `msedge`; có thể đặt `BC_BROWSER_CHANNEL=chrome` nếu dùng Chrome đã cài. Không cần chạy máy chủ web. Script ghi lại ba tệp hình từ định nghĩa trong mã, nên không chạy lại để giữ nguyên những chỉnh sửa chỉ được thực hiện trực tiếp trong draw.io.

## 5. Lưu ý khi viết báo cáo

- Gọi kiến trúc chính là **ba tầng**. Router, Service và Repository là các phần trong tầng ứng dụng, không phải ba microservice.
- Không mô tả frontend hiện tại chỉ là starter; mã hiện có nhiều màn hình nghiệp vụ. Đồng thời không coi có màn hình là đã nghiệm thu toàn bộ luồng.
- VNPAY hiện là tích hợp sandbox; Return không đồng nghĩa thanh toán đã thành công.
- SMTP phụ thuộc cấu hình; chatbot chưa khả dụng.
- Nguồn thực thi database là migration SQL, không phải SQL xuất từ DBML.
- Nội dung mô tả mã nguồn trong working tree, không phải tuyên bố bản live đang chạy hoặc kết quả test mới của hệ thống.
