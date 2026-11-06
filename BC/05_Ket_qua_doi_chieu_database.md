# 05. Kết quả đối chiếu database

## 1. Kết luận

Đối chiếu tĩnh ngày **06/11/2026** xác định chuỗi nguồn Alembic tuyến tính **`0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009`**, head trong repository là `0009`. Không chạy `alembic current`, không kết nối PostgreSQL/Supabase, không đọc `.env`, không migration/seed và không thay đổi mã nguồn.

`openwiki/database-design/DMS.dbml` đã cập nhật đủ hình dạng bảng đến head: **30 bảng, 293 cột, 30 PK, 64 FK**, không phát hiện lệch tên cột, kiểu, NOT NULL, PK hoặc đầu mút/FK action trong phạm vi bộ so sánh nguồn. Tuy nhiên **không thể gọi DBML gốc tương đương DDL hoàn toàn**: một partial unique bị mô tả thành unique toàn bảng; thiếu biểu thức CHECK trạng thái command, thiếu hai index GIN và ghi chú hành vi mới nhất. Bản `BC/Database/DMS.dbml` sửa các điểm này, không sửa bản nguồn.

## 2. Nguồn bằng chứng

Mọi đường dẫn sau tính từ thư mục gốc `D:\WorkSpace\projects\DMS`.

| Nguồn | Vị trí đáng chú ý | Giá trị bằng chứng |
| --- | --- | --- |
| `backend/alembic/versions/0001_create_dms_objects.py` đến `0009_historical_issue_corrections.py` | `revision`, `down_revision`, `upgrade()` | Xác định chuỗi/head và SQL thực sự được từng upgrade đọc; không suy head từ README. |
| `backend/alembic/sql/0001_initial.sql` | 10–18, 20–494 | Ba DOMAIN; 29 bảng ban đầu, cột/PK/FK/index/CHECK/generated. |
| Cùng file `0001_initial.sql` | 496–1403, 1518–1537 | Hàm, trigger trực tiếp và trigger tạo trong DO; kiểm ledger, khóa, audit, revoke. |
| Cùng file `0001_initial.sql` | 1405–1481 | Năm view, hai hàm báo cáo. |
| `backend/alembic/sql/0002_search_indexes.sql` | 3–13 | pg_trgm và hai index GIN tạo qua SQL động. |
| `backend/alembic/sql/0003_auth_sessions.sql` | 2–14, 15–29 | Thêm hai cột token, backfill/thu hồi token cũ, CHECK/session indexes và guard. |
| `backend/alembic/sql/0004_api_commands.sql` | 2–22, 23–46 | Bảng thứ 30, unique theo scope, CHECK result/recovery, trigger và revoke. |
| `backend/alembic/sql/0005_unit_policy.sql` | 3–27 | Khóa đơn vị trước kiểm tra lượng và bảo vệ chính sách đã được sử dụng. |
| `backend/alembic/sql/0006_eligible_owner_deletion.sql` | 4–57, 59–100 | Guard xóa owner/cache0, thay hai FK sang CASCADE; khóa first-use và bảo vệ ngày tiếp nhận. |
| `backend/alembic/sql/0007_return_lot_successors.sql` | 3–20 | Thay predicate trong guard_ledger, giữ nguồn lô dư có của cùng phiếu trả hàng. |
| `backend/alembic/sql/0008_historical_receipt_corrections.sql` | 3–19 | Thay predicate guard_revision cho correction phiếu nhập lịch sử. |
| `backend/alembic/sql/0009_historical_issue_corrections.sql` | 2–26 | Thay hai predicate hàng/đại lý trong guard_revision; predecessor `0008`. |
| `openwiki/database-design/DMS.dbml` | 86–128, 196–219, 267–303, 642–723 | Bản sơ đồ kế thừa; vị trí token/command/index/ghi chú revision và 64 Ref. |
| `openwiki/database-design/DMS.sql` | 1–6 | Entry point psql chỉ include `0001_initial.sql`. Không bao gồm migration tiếp theo. |
| `openwiki/database-design/README.md` | 23–47, 120–170, 258–369 | Bối cảnh nghiệp vụ, quy ước số, ranh giới SQL/service; checkpoint source 0008/runtime 0007 đã cũ. |
| `openwiki/database-design/business_decision_making.md` | Q01–Q15 và mục 3 | Lý do chọn version/reversal, FIFO, dư có riêng và làm tròn; không thay thế DDL. |

Các dòng checkpoint về Supabase, số chứng từ hay test đã chạy trong tài liệu cũ chỉ là ghi chép lịch sử. Báo cáo này không xác nhận lại trạng thái triển khai, số hàng live, tính toàn vẹn dữ liệu live hoặc thành công cổng thanh toán.

## 3. Diễn biến từng revision

| Revision và file Python | Snapshot SQL | Thay đổi liên quan ERD và thực thi |
| --- | --- | --- |
| `0001_create_dms_objects.py` | `0001_initial.sql` | Tạo schema dms, 29 bảng/279 cột, ba DOMAIN, generated/identity, index, FK, guard/deferred trigger, view/hàm báo cáo, dữ liệu cấu hình ban đầu và revoke. |
| `0002_add_search_indexes.py` | `0002_search_indexes.sql` | Không đổi bảng/cột/FK; thêm pg_trgm nếu thiếu và hai GIN index cho tên đại lý/mặt hàng. |
| `0003_auth_sessions.py` | `0003_auth_sessions.sql` | Không thêm bảng; auth_token thêm authVersion integer NOT NULL và sessionId UUID nullable, nâng tổng lên 281 cột; backfill, thu hồi token cũ, thêm CHECK/index/guard. |
| `0004_api_commands.py` | `0004_api_commands.sql` | Thêm api_idempotency với 12 cột và một FK actor; tổng 30 bảng/293 cột/64 FK. |
| `0005_unit_policy.py` | `0005_unit_policy.sql` | Chỉ hàm/trigger; serialize first-use unit và cấm đổi allowsFraction sau dòng đã ghi nhận. |
| `0006_eligible_owner_deletion.py` | `0006_eligible_owner_deletion.sql` | Đổi hai FK cache-owner từ RESTRICT thành CASCADE có guard; thêm hàm/trigger bảo vệ xóa đủ điều kiện, đơn vị mặt hàng và ngày tiếp nhận. Không thêm cột. |
| `0007_return_lot_successors.py` | `0007_return_lot_successors.sql` | Sửa guard_ledger bằng pg_get_functiondef/replace; successor hiện hành POSTED của cùng SALES_RETURN được dùng lô gốc. Không đổi FK/cột. |
| `0008_historical_receipt_corrections.py` | `0008_historical_receipt_corrections.sql` | Sửa guard_revision cho cặp product/unit từng POSTED của cùng receipt; không cho inactive mới. Không đổi FK/cột. |
| `0009_historical_issue_corrections.py` | `0009_historical_issue_corrections.sql` | Mở chính sách lịch sử tương ứng cho issue và đại lý đã TERMINATED khi phiếu từng POSTED; không nới điều kiện bán mới. Không đổi FK/cột. |

Các revision `0007–0009` thay thân hàm đã có, vì vậy chỉ đếm `CREATE TABLE` hoặc nhìn hình ERD không thể nhận biết thay đổi nghiệp vụ. SQL có guard báo lỗi nếu predicate tiền nhiệm không đúng kỳ vọng; lần đối chiếu này đọc mã và kiểm hình dạng, không thực thi cơ chế introspection/replace trên PostgreSQL. Các hàm downgrade được đọc để hiểu lịch sử nhưng **không áp dụng downgrade khi tính schema head**.

## 4. Đối chiếu định lượng

| Hạng mục | Kết quả nguồn ở head |
| --- | ---: |
| Bảng ứng dụng dms | 30 |
| Cột, bao gồm generated/timestamp | 293 |
| PK, mỗi bảng một PK đơn | 30 |
| Cột timestamp createdAt/updatedAt bắt buộc | 60 |
| FK, đếm mỗi constraint một lần | 64 |
| FK ghép | 6 |
| FK tự tham chiếu | 5 |
| Delete action RESTRICT / CASCADE / NO ACTION | 61 / 2 / 1 |
| FK DEFERRABLE INITIALLY DEFERRED | 3 |
| DOMAIN số | 3 |
| Cột generated stored | 6 |
| View | 5 |
| Hàm báo cáo theo khoảng ngày | 2 |

Sáu FK ghép gồm document/current revision; document_line/origin line; inventory_entry/line; receivable_entry/issue; credit_lot/origin receipt; credit_entry/lot. Không cộng các cột thành nhiều FK. Năm self-reference là document/origin document, document_line/origin line và ba entry/reversal. Sáu generated stored gồm agency.code, product.code, document.code, document_line.lineAmount, stock_count.code, stock_count_line.difference. Các số đếm không bao gồm sequence identity, index ngầm sinh từ PK/UNIQUE hay constraint trigger nội bộ do FK.

## 5. Sai khác DBML gốc và cách hiệu chỉnh

| Sai khác/giới hạn | Bằng chứng | Xử lý trong BC/Database/DMS.dbml |
| --- | --- | --- |
| UNIQUE(sessionId) toàn bảng sai ngữ nghĩa | DBML gốc dòng 106 có `[unique]`; SQL 0003:13–14 chỉ unique khi purpose REFRESH và revokedAt NULL. Rotation cần giữ nhiều token cũ cùng session. | Bỏ unique toàn cục ở index này; giữ tên và ghi rõ partial UNIQUE/predicate trong note. Đây là giới hạn biểu diễn, không thay SQL. |
| CHECK hợp trạng thái command chỉ nằm trong note | SQL 0004:16–21 yêu cầu result/recovery phù hợp từng state; DBML gốc không có expression tương ứng. | Thêm checks block `ck_api_idempotency_result` với biểu thức nguyên nghĩa. |
| Thiếu hai GIN name-contains indexes | SQL 0002:11–12; DBML gốc chỉ có prefix indexes. | Thêm tên/expression và note USING gin/gin_trgm_ops, không giả rằng DBML tái tạo opclass/extension. |
| Ghi chú lịch sử receipt dừng ở 0008, chưa nêu issue 0009 | SQL 0009 thay predicate hàng và đại lý. | Bổ sung điều kiện historical issue/terminated agency và giới hạn không bán mới. |
| Lô dư có chưa giải thích successor 0007 | SQL 0007 sửa guard_ledger nhưng FK/sourceRevisionId không đổi. | Bổ sung note về giữ lô/nguồn gốc, không sửa quan hệ. |
| Header tham chiếu DMS.sql có thể bị hiểu là head | DMS.sql chỉ include 0001. | Ghi rõ nguồn migration 0001..0009 và không xuất SQL từ DBML để deploy. |

Các partial unique khác được giữ theo nguyên tắc note-only khi không tương đương toàn bảng: `uq_document_auto_receipt`, `uq_posting_batch_post`, `uq_refund_attempt_inflight`. Với `uq_document_current_revision`, WHERE chỉ loại NULL nên unique nullable thông thường tương đương về tập giá trị khác NULL, nhưng không tương đương vật lý về index. Hai FK CASCADE `0006` đã đúng trong DBML gốc, không cần sửa cấu trúc.

## 6. Phương pháp và giới hạn xác minh

Đã đọc hướng dẫn gốc/backend, danh sách revision, từng SQL `0001..0009`, DBML và các tài liệu schema liên quan. Đã chạy bộ phân tích Node.js tạm trong bộ nhớ bằng PowerShell here-string đưa vào `node`; không tạo script, không import cấu hình ứng dụng, không tải `.env`, không khởi tạo engine hoặc connection. Bộ so sánh nhận dạng CREATE TABLE, khai báo cột và REFERENCES/FK trong snapshot, cộng hai cột `0003`, áp hai FK action `0006`, và đọc Ref DBML kể cả đầu FK ở bên phải dấu `-`.

Lần so sánh DBML gốc trả về `tables=30`, `columns=293`, `foreignKeys=64`, `dbmlRefs=64`, `columnDiffs=[]`, `missingRefs=[]`, `extraRefs=[]`. Thuộc tính được so sánh theo từng cột là tên, kiểu SQL/domain, NOT NULL (gồm PK ngầm NOT NULL), PK. FK so theo bảng/cột nguồn, bảng/cột đích và delete action; không yêu cầu tên Ref DBML phải trùng tên constraint PostgreSQL tự sinh.

Đã chạy lại cùng phép đối chiếu trên **bản bàn giao** `BC/Database/DMS.dbml`: 30 bảng/293 cột/30 PK/60 timestamp/64 Ref; `columnDiffs=[]`, `missingRefs=[]`, `extraRefs=[]`. Bộ đếm xác nhận sáu FK ghép, năm FK tự tham chiếu, delete actions 61 RESTRICT/2 CASCADE/1 NO ACTION. Tám TableGroup phủ đúng 30 bảng, mỗi bảng một nhóm; tổng cột theo nhóm lần lượt 35, 12, 49, 66, 41, 57, 21, 12. Kiểm tra riêng xác nhận bỏ unconditional session UNIQUE, có CHECK command và hai note GIN.

Kiểm tra nội dung bốn tệp bằng Node: không có ký tự thay thế Unicode U+FFFD, không có khoảng trắng cuối dòng, tất cả liên kết tương đối trong Markdown tồn tại. `git diff --check -- BC openwiki/database-design backend/alembic` không báo lỗi; vì BC còn untracked, phép kiểm Node riêng mới là bằng chứng nội dung tệp mới. `git status --short -- BC openwiki/database-design backend/alembic` chỉ báo `?? BC/`, không có thay đổi DBML/SQL/revision nguồn. SHA-256 UTF-8 của DBML gốc là `187e833b8f2ac22a7b70a3ffe4b67ff08b6fa46e1808d26c7d8db61e15dfbd39`; bản DBML bàn giao là `057665ffdb7073ad1af2816857cb7e5fdd19292fa4d89ecacfacdee2f208fead`.

Đây là parser nhận dạng cấu trúc nguồn giới hạn cho cú pháp hiện có, **không phải PostgreSQL parser/catalog thực**. Không chứng minh tương đương mọi CHECK/default/index/generated expression bằng AST; các điểm thay đổi nêu trên được đọc trực tiếp trong SQL. Không kiểm toàn bộ đường chạy PL/pgSQL, trigger động, locking/concurrency, grant/role runtime, migration trên dữ liệu có sẵn hoặc số liệu báo cáo. Không chạy lại test offline/PG lịch sử và không gán kết quả lịch sử thành kết quả mới.

Sau đối chiếu cấu trúc, đã kiểm tra thêm bằng CLI chính thức **`@dbml/cli` phiên bản `11.0.1`**. Lệnh `npm exec --yes --package=@dbml/cli -- dbml2sql "D:\WorkSpace\projects\DMS\BC\Database\DMS.dbml" --postgres -o "C:\Users\23521\AppData\Local\Temp\kilo\dms-report-parser-check.sql"` hoàn tất với exit code 0 và tạo SQL kiểm tra trong thư mục tạm. Package được lấy qua npm cache, không thêm dependency hay thay lockfile của dự án. Parser chạy cục bộ; không tải nội dung DBML lên dbdiagram.io và không thực thi SQL sinh ra.

Kết quả xác nhận DBML được parser chính thức chấp nhận. Chưa mở/import bằng giao diện web dbdiagram.io. **SQL xuất ra chỉ là sản phẩm kiểm tra parser, không phải bản migration và không được dùng để triển khai**: domain, trigger, generated expression, partial index và các cơ chế PostgreSQL khác vẫn cần nguồn SQL gốc. Việc parse thành công không chứng minh tương đương mọi ngữ nghĩa với DDL thực thi.

## 7. Hồ sơ bàn giao

- `BC/Database/DMS.dbml`: mô hình bảng đầy đủ cho ERD, giữ 30 bảng/293 cột/64 FK và sửa sai khác đã xác minh.
- `BC/04_Mo_ta_co_so_du_lieu.md`: từ điển nhóm bảng, cột, khóa, luồng nghiệp vụ và ranh giới logic/thực thi.
- `BC/05_Ket_qua_doi_chieu_database.md`: nguồn bằng chứng, chuỗi revision, phương pháp/kết quả/giới hạn.
- `BC/Prompts/Tong_quan_database.txt`: yêu cầu hình khái niệm đen trắng, không thay ERD chính xác từ DBML.

Chỉ bốn tệp này thuộc thay đổi của công việc database. Các thay đổi sẵn có và các tài liệu do người/agent khác tạo trong worktree được giữ nguyên. Không commit, không seed, không migration và không thao tác database live.
