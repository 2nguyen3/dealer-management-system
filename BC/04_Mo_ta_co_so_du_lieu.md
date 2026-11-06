# 04. Mô tả cơ sở dữ liệu Agentra DMS

## 1. Phạm vi và nguồn

Cơ sở dữ liệu sử dụng PostgreSQL, tổ chức dữ liệu ứng dụng trong schema `dms`. Phạm vi nghiệp vụ là một doanh nghiệp, một kho, tiền VNĐ; không bao gồm nhà cung cấp, công nợ nhà cung cấp, đa kho, đa tiền tệ hoặc sổ cái kế toán kép. Sổ kho, phải thu và dư có trong thiết kế là các sổ phân hệ.

Báo cáo lập ngày 06/11/2026 bằng đối chiếu mã nguồn. Chuỗi migration hiện có kết thúc tại **revision `0009`**, gồm **30 bảng, 293 cột, 30 khóa chính và 64 quan hệ khóa ngoại** trong `dms`. Trong đó có 29 bảng nghiệp vụ/hỗ trợ và một bảng hạ tầng `api_idempotency`. Con số này không gồm `public.alembic_version`, bảng hệ thống PostgreSQL hoặc các schema nội bộ Supabase. Không kiểm tra dữ liệu hay revision trên database đang chạy trong lần lập báo cáo này.

Nguồn cấu trúc và thực thi là `backend/alembic/versions/*.py` cùng chín snapshot SQL trong `backend/alembic/sql/`. Bản [Database/DMS.dbml](Database/DMS.dbml) kế thừa `openwiki/database-design/DMS.dbml`, đã đối chiếu và hiệu chỉnh cho bộ báo cáo. `openwiki/database-design/DMS.sql` chỉ trỏ tới snapshot `0001`, không phải toàn bộ schema ở head. Xem [05_Ket_qua_doi_chieu_database.md](05_Ket_qua_doi_chieu_database.md) để biết giới hạn kiểm chứng.

## 2. Quy ước dữ liệu

| Thành phần | Quy ước và ý nghĩa |
| --- | --- |
| Tên | Bảng `snake_case`; cột nhiều từ dùng `camelCase`, được quote trong SQL để giữ đúng hoa/thường. |
| Khóa | Danh mục nhỏ dùng `integer`; phần lớn nghiệp vụ dùng `bigint GENERATED ALWAYS AS IDENTITY`. Riêng quy định dùng khóa boolean `true`, command dùng UUID, hai cache dùng chính FK chủ sở hữu làm PK. |
| Mã hiển thị | `DL-`, `MH-`, `PN-`, `PX-`, `PT-`, `DC-`, `TH-`, `BT-`, `HT-`, `KK-` sinh từ ID/loại. Mã không thay thế FK số và không bảo đảm liên tục sau rollback. |
| Thời gian chung | Cả 30 bảng đều có `createdAt`, `updatedAt`: `timestamptz NOT NULL`, mặc định `clock_timestamp()`. Hàm `stamp_row` quản lý thời điểm; 60 cột này được tính trong 293 cột. |
| Ngày nghiệp vụ | `businessDate` là `date`; `businessOrder` là thứ tự ổn định lúc ghi nhận đầu, không lấy `updatedAt` làm thứ tự nghiệp vụ. |
| `money_vnd` | DOMAIN trên NUMERIC không typmod; số nguyên, trị tuyệt đối nhỏ hơn 10^18, loại NaN/vô cực. Dấu âm chỉ được dùng tại nơi quy tắc cho phép, ví dụ bút toán giảm. |
| `quantity_value` | DOMAIN NUMERIC, tối đa ba chữ số lẻ có nghĩa, trị tuyệt đối nhỏ hơn 10^15; đơn vị không cho phần lẻ còn bị kiểm bằng trigger. |
| `price_rate` | DOMAIN NUMERIC với `0 < value < 1000`, tối đa sáu chữ số lẻ có nghĩa. |
| Trạng thái | `text` kết hợp CHECK, không phải enum PostgreSQL. CHECK tập giá trị không tự bảo đảm thứ tự chuyển trạng thái. |
| JSONB | Dùng cho kết quả command an toàn, bằng chứng tối thiểu và audit trước/sau; chi tiết hàng và liên kết nghiệp vụ vẫn có bảng/cột/FK riêng. |

Không dùng float cho tiền. Đơn giá xuất được làm tròn sau khi nhân giá nhập snapshot với tỷ lệ snapshot; thành tiền từng dòng được làm tròn, tổng phiếu là tổng các dòng. Trả từng phần dùng làm tròn lũy kế trừ giá trị đã trả trước đó, tránh hoàn vượt tiền gốc. Các DOMAIN chủ động từ chối độ chính xác không hợp lệ thay vì âm thầm làm tròn như NUMERIC có typmod.

## 3. Từ điển bảng theo nhóm

Các bảng dưới đây liệt kê toàn bộ cột ngoài hai cột thời gian chung `createdAt`, `updatedAt` đã quy ước ở trên. Số cột trong ngoặc **đã gồm** hai timestamp. PK mặc định là `id`; ngoại lệ được ghi rõ. Các khóa duy nhất và quan hệ trong cột cuối là những khóa quan trọng; DBML chứa danh mục chi tiết về kiểu, NULL, default, CHECK và 64 FK.

### 3.1. Người dùng và phân quyền: 5 bảng, 35 cột

| Bảng | Các cột ngoài timestamp chung | Khóa, liên kết và vai trò |
| --- | --- | --- |
| `user_group` (5) | `id`, `code`, `name` | PK integer; code và name unique. Một nhóm có nhiều tài khoản/quyền. |
| `app_function` (5) | `id`, `code`, `name` | PK integer; code unique, mã chức năng ổn định; audit tham chiếu code. |
| `app_user` (9) | `id`, `fullName`, `email`, `passwordHash`, `groupId`, `status`, `authVersion` | FK groupId; unique `lower(email)`. Mỗi tài khoản thuộc một nhóm; ACTIVE/LOCKED. |
| `group_permission` (6) | `id`, `groupId`, `functionId`, `isAllowed` | FK nhóm/chức năng; unique `(groupId,functionId)`, biểu diễn quan hệ nhiều-nhiều có cờ cho phép. |
| `auth_token` (10) | `id`, `userId`, `purpose`, `tokenDigest`, `authVersion`, `sessionId`, `expiresAt`, `revokedAt` | FK user; digest 32 byte unique. REFRESH có sessionId, PASSWORD_RESET không có. Partial unique chỉ cho một refresh chưa thu hồi trong mỗi session. |

`app_user` không phải tài khoản Supabase Auth. SQL bảo vệ phiên bản thông tin xác thực, định danh token và thu hồi một chiều; backend chịu trách nhiệm hash mật khẩu, xác thực token, kiểm khóa tài khoản và áp quyền chức năng. Nhiều token đã thu hồi có thể cùng `sessionId`, cần thiết cho luân phiên refresh token.

### 3.2. Hạ tầng retry: 1 bảng, 12 cột

| Bảng | Các cột ngoài timestamp chung | Khóa, liên kết và vai trò |
| --- | --- | --- |
| `api_idempotency` (12) | `id`, `actorId`, `operationId`, `resourceScope`, `clientKey`, `requestDigest`, `formatVersion`, `state`, `result`, `recovery` | PK UUID; FK actor; unique `(actorId,operationId,resourceScope,clientKey)`. CHECK đồng bộ CLAIMED/COMPLETED/ACCEPTED với result/recovery. |

Bảng được thêm ở `0004` để lưu định danh và kết quả thao tác lặp. Đây không phải log request hay nơi lưu credential. Trigger cấm xóa, cấm đổi định danh/kết quả đã hoàn tất; ACCEPTED chỉ được chuyển sang COMPLETED. SQL không tự chọn nội dung an toàn để lưu, việc tạo projection an toàn thuộc backend.

### 3.3. Quy định và dữ liệu chủ: 6 bảng, 49 cột

| Bảng | Các cột ngoài timestamp chung | Khóa, liên kết và vai trò |
| --- | --- | --- |
| `business_rule` (5) | `id`, `maxAgenciesPerDistrict`, `sellingPriceRate` | PK boolean, CHECK id=true cho tối đa một dòng; seed tạo dòng và guard chặn xóa. |
| `district` (6) | `id`, `code`, `name`, `status` | PK integer; code/name unique; ACTIVE/INACTIVE. |
| `agency_type` (7) | `id`, `code`, `name`, `maxDebt`, `status` | PK integer; code/name unique; hạn mức không âm của từng loại. |
| `unit` (7) | `id`, `code`, `name`, `allowsFraction`, `status` | PK integer; code/name unique; quy định đơn vị đếm hay lượng có phần lẻ. |
| `agency` (16) | `id`, `code`, `name`, `typeId`, `districtId`, `phone`, `address`, `email`, `acceptedDate`, `status`, `terminatedAt`, `terminationReason`, `createdBy`, `updatedBy` | FK loại/quận/người tạo/người sửa; code generated unique. Tên không unique; ACTIVE/TERMINATED. |
| `product` (8) | `id`, `code`, `name`, `unitId`, `lowStockThreshold`, `status` | FK đơn vị; code generated unique. Tồn/giá không lưu trên product mà ở cache riêng. |

SQL kiểm sức chứa quận khi tiếp nhận/chuyển đại lý, hạn mức khi đổi loại/hạ giới hạn và cấm mở lại đại lý đã chấm dứt. Revision `0005` bảo vệ chính sách phần lẻ sau khi có dòng chứng từ hoặc kiểm kê; `0006` bảo vệ đơn vị của mặt hàng từ lần sử dụng đầu, kể cả dòng nháp, và bảo vệ ngày tiếp nhận so với lịch sử đã ghi. Xóa đại lý/hàng chưa dùng chỉ được phép khi không có lịch sử và cache bằng 0 theo guard, không suy diễn từ CASCADE rằng có thể xóa lịch sử tùy ý.

### 3.4. Chứng từ và khoản trả ngay: 4 bảng, 66 cột

| Bảng | Các cột ngoài timestamp chung | Khóa, liên kết và vai trò |
| --- | --- | --- |
| `document` (16) | `id`, `creationKey`, `kind`, `code`, `agencyId`, `originDocumentId`, `receiptType`, `status`, `currentRevisionId`, `businessOrder`, `cancelledBy`, `cancelledAt`, `cancelReason`, `createdBy` | creationKey/code/businessOrder unique; FK đại lý, phiếu nguồn, tác nhân và FK ghép phiên bản hiện hành. Định danh phiếu ổn định. |
| `document_revision` (23) | `id`, `documentId`, `revisionNo`, `state`, `businessDate`, `totalAmount`, `immediatePayment`, `sellingPriceRate`, `maxDebtSnapshot`, `paymentMethod`, `agencyName`, `agencyAddress`, `agencyPhone`, `agencyEmail`, `reason`, `note`, `createdBy`, `readyBy`, `readyAt`, `postedBy`, `postedAt` | FK document/tác nhân; unique `(documentId,revisionNo)` và `(id,documentId)`. Nội dung, giá và liên hệ snapshot của mỗi phiên bản. |
| `document_line` (15) | `id`, `revisionId`, `lineNo`, `productId`, `unitId`, `productName`, `unitName`, `quantity`, `unitPrice`, `basePurchasePrice`, `returnAmount`, `lineAmount`, `originLineId` | FK revision/product/unit; FK ghép dòng trả gốc. Unique `(revisionId,lineNo)` và `(revisionId,productId)`. lineAmount generated stored. |
| `upfront_confirmation` (12) | `id`, `issueRevisionId`, `amount`, `method`, `receivedAt`, `verifiedBy`, `verifiedAt`, `evidenceReference`, `state`, `receiptDocumentId` | FK phiên bản xuất/người xác minh/phiếu thu; issueRevisionId và receiptDocumentId unique. Tiền thực nhận trước xuất, chưa đồng nghĩa giảm nợ. |

`document.status` có DRAFT/PENDING/POSTED/CANCELLED; `document_revision.state` có DRAFT/READY/POSTED. Hai tập trạng thái không đồng nhất: PENDING của phiếu tương ứng READY của phiên bản hiện hành. Một phiếu có nhiều phiên bản; có tối đa một phiên bản được chọn hiện hành. FK ghép `(currentRevisionId,id) -> document_revision(id,documentId)` ngăn trỏ sang phiên bản phiếu khác. Yêu cầu phiên bản hiện hành tồn tại và trạng thái khớp được thực thi bởi deferred checks, không chỉ bởi hình vẽ ERD.

### 3.5. Thanh toán online và hoàn tiền: 4 bảng, 41 cột

| Bảng | Các cột ngoài timestamp chung | Khóa, liên kết và vai trò |
| --- | --- | --- |
| `online_payment` (14) | `id`, `agencyId`, `provider`, `merchantReference`, `idempotencyKey`, `providerTransactionId`, `amount`, `status`, `expiresAt`, `paymentTime`, `receiptDocumentId`, `createdBy` | FK đại lý/phiếu thu/người tạo; merchantReference, idempotencyKey, receiptDocumentId unique; unique cặp provider/transaction. |
| `payment_event` (7) | `id`, `paymentId`, `eventKey`, `providerStatus`, `verifiedPayload` | FK payment; unique `(paymentId,eventKey)`; bằng chứng callback append-only. |
| `refund_reservation` (7) | `id`, `refundRevisionId`, `lotId`, `amount`, `state` | FK revision/lô; unique `(refundRevisionId,lotId)`; ACTIVE/RELEASED/CONSUMED. |
| `refund_attempt` (13) | `id`, `refundRevisionId`, `onlinePaymentId`, `idempotencyKey`, `merchantRefundReference`, `providerRefundId`, `amount`, `state`, `completedAt`, `failureReason`, `verifiedResponse` | FK revision/payment; khóa retry unique, unique provider refund theo payment; partial unique một attempt PENDING/UNKNOWN/SUCCESS mỗi revision. |

Một thanh toán SUCCESS phải có event thành công và đúng một phiếu thu khớp đại lý, phương thức, tổng tiền. Backend phải xác minh chữ ký/reference/amount và gọi cổng thanh toán; tên `verifiedPayload` không làm dữ liệu tự đáng tin. Khoản online vượt phần nợ còn lại khi callback đến được ghi đủ tiền và tạo dư có cho phần dư. UNKNOWN của hoàn tiền giữ reservation; không coi timeout là hoàn thất bại để giải phóng tiền. Hoàn đã trả thành công không được hủy như tiền chưa từng ra.

### 3.6. Ghi sổ, cache và dư có: 7 bảng, 57 cột

| Bảng | Các cột ngoài timestamp chung | Khóa, liên kết và vai trò |
| --- | --- | --- |
| `posting_batch` (7) | `id`, `revisionId`, `kind`, `idempotencyKey`, `createdBy` | FK revision/tác nhân; idempotencyKey unique; partial unique một POST mỗi revision, vẫn có REVERSE/REALLOCATE. |
| `inventory_balance` (6) | `productId`, `currentStock`, `currentPurchasePrice`, `priceSourceLineId` | PK=FK productId; FK dòng nguồn giá. Một cache mỗi mặt hàng, SQL tự khởi tạo/cập nhật. |
| `agency_balance` (5) | `agencyId`, `currentDebt`, `currentCredit` | PK=FK agencyId; cache nợ và dư có riêng, không dùng nợ âm để biểu diễn dư có. |
| `inventory_entry` (11) | `id`, `batchId`, `lineId`, `productId`, `unitId`, `quantity`, `businessDate`, `businessOrder`, `reversesEntryId` | FK batch/product/unit, FK ghép line/product/unit; FK tự tham chiếu reversal unique. Delta kho có dấu. |
| `receivable_entry` (11) | `id`, `batchId`, `agencyId`, `issueDocumentId`, `kind`, `amount`, `businessDate`, `businessOrder`, `reversesEntryId` | FK batch/agency, FK ghép issue/agency và reversal unique. Đồng thời là sổ phải thu và chi tiết phân bổ thanh toán. |
| `credit_lot` (6) | `id`, `agencyId`, `sourceRevisionId`, `originReceiptId` | FK agency/source revision; FK ghép receipt/agency, unique `(id,agencyId)`. Truy nguồn tiền gốc. |
| `credit_entry` (11) | `id`, `batchId`, `agencyId`, `lotId`, `kind`, `amount`, `businessDate`, `businessOrder`, `reversesEntryId` | FK batch/agency, FK ghép lot/agency và reversal unique. CREATED/REFUND/OFFSET. |

Ba bảng entry, posting_batch và credit_lot là append-only. Sửa sai không UPDATE/DELETE bút toán: thêm bút toán đảo chính xác rồi ghi ảnh hưởng thay thế trong cùng transaction. Reversal giữ ngày/thứ tự/định danh và đổi dấu; không đảo một reversal. `assert_product`, `assert_agency`, `assert_document` kiểm lịch sử và đối chiếu sổ với chứng từ hiện hành, cập nhật cache bằng deferred triggers.

Một khoản thu có thể phân bổ nhiều phiếu xuất và một phiếu xuất nhận nhiều khoản thu. Không có bảng `payment_allocation` riêng: `receivable_entry` đã mang nguồn batch, phiếu đích và số tiền. FIFO ở đây là phân bổ trả nợ theo ngày/thứ tự phiếu, không phải phương pháp giá vốn hàng tồn kho. Revision `0007` giữ lô dư có gốc khi tạo successor POSTED hiện hành của cùng phiếu trả hàng, bảo toàn nguồn tiền và các reservation/refund đã tham chiếu.

### 3.7. Kiểm kê: 2 bảng, 21 cột

| Bảng | Các cột ngoài timestamp chung | Khóa, liên kết và vai trò |
| --- | --- | --- |
| `stock_count` (11) | `id`, `code`, `state`, `countedAt`, `createdBy`, `confirmedBy`, `confirmedAt`, `adjustmentDocumentId`, `reason` | FK tác nhân/chứng từ điều chỉnh; code generated unique, adjustmentDocumentId unique; DRAFT/CONFIRMED. |
| `stock_count_line` (10) | `id`, `countId`, `productId`, `unitId`, `bookQuantity`, `countedQuantity`, `difference`, `observedLastEntryId` | FK count/product/unit/entry quan sát; unique `(countId,productId)`; difference generated stored. |

Giữ cả dòng chênh lệch 0. Khi xác nhận, SQL kiểm số tồn và entry mới nhất có còn khớp snapshot; nếu thay đổi phải đối chiếu/đếm lại. Chênh lệch khác 0 cần phiếu điều chỉnh POSTED có dòng khớp; tất cả bằng 0 thì không lập phiếu điều chỉnh rỗng. Kiểm kê đã xác nhận và phiếu điều chỉnh liên quan là bằng chứng lịch sử.

### 3.8. Nhật ký: 1 bảng, 12 cột

| Bảng | Các cột ngoài timestamp chung | Khóa, liên kết và vai trò |
| --- | --- | --- |
| `audit_log` (12) | `id`, `actorId`, `actorType`, `functionCode`, `action`, `entityName`, `entityKey`, `oldData`, `newData`, `requestId` | FK actor tùy chọn và functionCode; USER phải có actor, SYSTEM không có; append-only. |

Trigger audit được đăng ký cho các bảng metadata/chuyển trạng thái cụ thể trong `0001_initial.sql:1518–1532`, không khẳng định mọi thao tác trên mọi bảng đều sinh audit. Ledger tự là chi tiết bất biến. `entityName/entityKey` là địa chỉ đối tượng nhật ký, không phải FK đa hình. Trigger loại `passwordHash` và `tokenDigest` khỏi snapshot trước/sau; backend cung cấp context tác nhân/request/chức năng trong transaction.

## 4. Các loại chứng từ và ảnh hưởng

| kind | Nội dung | Ảnh hưởng khi ghi nhận hợp lệ |
| --- | --- | --- |
| STOCK_RECEIPT | Phiếu nhập, có dòng hàng, không đại lý | Kho tăng; có thể thay nguồn giá nhập hiện tại. |
| STOCK_ISSUE | Phiếu xuất, có đại lý/dòng hàng; chốt READY trước POSTED | Kho giảm, tăng phải thu; trả ngay tạo phiếu thu tự sinh cùng transaction. |
| PAYMENT_RECEIPT | Phiếu thu, không dòng hàng | Giảm nợ theo phân bổ; trường hợp tiền ngoài thực nhận được phép dư thì tạo dư có. |
| STOCK_ADJUSTMENT | Điều chỉnh lượng có dấu, giá 0 | Chỉ điều chỉnh kho, không doanh số bán. |
| SALES_RETURN | Trả hàng theo phiếu/dòng xuất gốc | Kho tăng; giảm nợ phần chưa trả, phần đã trả tạo dư có theo nguồn tiền. |
| CREDIT_APPLICATION | Bù dư có, không có tiền mới | Giảm dư có và phải thu cùng số tiền hợp lệ. |
| REFUND | Hoàn tiền theo phiếu thu nguồn | Giảm dư có khi tiền thực sự trả thành công; không phải nghiệp vụ trả hàng. |

Sửa sai hồi tố tính lại kỳ ngày nghiệp vụ gốc, khác với trả hàng/hoàn tiền mới theo ngày thực tế. Revision `0008` và `0009` không thêm loại phiếu hay cột: chúng sửa guard để correction nhập/xuất được tái dùng cặp hàng/đơn vị từng POSTED trên chính phiếu dù dữ liệu chủ nay INACTIVE. `0009` còn cho sửa phiếu xuất đã từng POSTED khi đại lý đã TERMINATED. Đây không phải quyền xuất mới cho đại lý ngừng hợp tác hoặc thêm hàng inactive chưa từng ghi nhận; các kiểm tra còn lại vẫn giữ.

## 5. Quan hệ và lớp thực thi

| Quan hệ/ràng buộc | Mô hình logic và thực thi vật lý |
| --- | --- |
| Chứng từ → phiên bản → dòng | 1-n theo FK; bản nháp có thể chưa có dòng. Yêu cầu có dòng khi chốt phiếu kho do `assert_document`, không do đường nối ERD. |
| Chứng từ → phiên bản hiện hành | FK ghép và unique currentRevision; DEFERRABLE cho phép tạo/chuyển liên kết trong transaction. |
| Dòng trả → dòng bán | FK ghép bốn cột bảo toàn hàng/đơn vị/giá; trigger kiểm thuộc đúng phiếu nguồn, tổng lượng và làm tròn. |
| Entry → phiếu/lô cùng đại lý | FK ghép bảo toàn ownership; guard thêm kiểm kind, dấu, ngày/thứ tự và nguồn. |
| Chủ sở hữu → cache | PK/FK cho tối đa một cache mỗi owner; trigger khởi tạo cung cấp dòng thực tế. CASCADE ở `0006` đi kèm guard xóa owner đủ điều kiện. |
| Online → phiếu thu | FK unique cho tối đa một liên kết; CHECK/deferred reconciliation yêu cầu liên kết và chứng từ đúng khi SUCCESS. |
| Chống lặp | Unique toàn bảng, unique ghép và partial unique; retry business transaction vẫn cần backend phối hợp. |
| Toàn vẹn liên bảng | Deferred constraint triggers kiểm tại cuối transaction hoặc khi force constraints; service phải lập đúng dữ liệu, khóa đúng thứ tự và commit trước khi trả thành công. |

Trong 64 FK có **6 FK ghép**, **5 FK tự tham chiếu** (hai nhóm có giao nhau), **2 ON DELETE CASCADE**, **1 NO ACTION** và **61 RESTRICT**. Có ba FK `DEFERRABLE INITIALLY DEFERRED`: document/current revision, online payment/receipt, stock count/adjustment. Không suy diễn khả năng xóa chỉ từ ký hiệu quan hệ: guard nghiệp vụ có thể từ chối dù FK cho phép.

DBML thể hiện bảng/cột/khóa và các CHECK biểu thức; ghi chú không phải cơ chế thực thi. SQL thực thi DOMAIN, generated stored, partial unique, function/trigger, khóa hàng và quyền DB. Backend thực thi xác thực/RBAC, điều phối phiên bản/bút toán/replay, kiểm chữ ký và gọi nhà cung cấp. Không lớp nào thay thế hoàn toàn hai lớp còn lại.

## 6. Mô hình đọc và index

Năm view có sẵn trong `0001_initial.sql:1405–1443`: `current_document` (phiếu và phiên bản hiện hành), `agency_overview` (hồ sơ và số dư), `inventory_overview` (tồn, giá bán tính toán, cảnh báo), `invoice_balance` (nợ từng phiếu xuất), `credit_availability` (dư có, phần đã dành, phần khả dụng). Hai hàm báo cáo `sales_report(date,date)` và `debt_report(date,date)` ở dòng 1446–1481 dùng khoảng ngày nửa mở. Chúng là đối tượng SQL, không phải bảng lưu báo cáo tháng; việc tồn tại hàm SQL không chứng minh API báo cáo hiện hành gọi trực tiếp hàm đó.

Index phục vụ email không phân biệt hoa thường, danh mục theo quận/loại, hàng chờ, lịch sử theo chủ sở hữu/ngày/thứ tự và audit. `0002_search_indexes.sql` bổ sung hai GIN expression index `ix_agency_name_contains`, `ix_product_name_contains` trên `lower(name)` với `gin_trgm_ops`, xử lý schema extension có thể khác nhau. Sự tồn tại index trong nguồn không chứng minh hiệu năng thực tế; chưa chạy EXPLAIN hay kiểm thử tải trong lần báo cáo này.

## 7. Giới hạn sử dụng sơ đồ

[Database/DMS.dbml](Database/DMS.dbml) là nguồn chi tiết để dựng ERD trong bộ báo cáo; sơ đồ khái niệm từ [Prompts/Tong_quan_database.txt](Prompts/Tong_quan_database.txt) chỉ minh họa nhóm và luồng quan hệ chính. Không dùng ảnh sinh tự động làm bằng chứng đủ 293 cột/64 FK. Không dùng SQL xuất từ DBML để triển khai, vì thiếu các cơ chế thực thi PostgreSQL đã nêu. Nguồn triển khai cuối cùng vẫn là chuỗi migration và snapshot SQL bất biến.
