# Danh sách chức năng nghiệp vụ

Ngày đối chiếu: **13/11/2026**, nhánh `deploy-prod`. Danh sách lấy từ OpenAPI sinh **trực tiếp từ ứng dụng FastAPI** (`create_app().openapi()`, không kết nối database) và đối chiếu với `backend/app/api/router.py`; quyền lấy từ `x-permissions` của từng operation. Cột giao diện được xác định bằng cách đọc `ui/src/app/navigation.ts`, `ui/src/app/App.tsx` và lời gọi API trong `ui/src/features/*`.

- Mọi đường dẫn có tiền tố `/api/v1`.
- **allOf** = cần đủ mọi quyền; **anyOf** = cần ít nhất một quyền.
- Giao diện: **Có** = có màn hình/nút gọi API này; **Không** = backend có nhưng giao diện chưa gọi trực tiếp; **Hệ thống** = được gọi tự động, không có màn hình riêng.
- Lệnh ghi dùng `Idempotency-Key`; sửa/xóa dùng `If-Match` (ETag). Logic tiền chi tiết ở [06_Logic_nghiep_vu_dong_tien.md](06_Logic_nghiep_vu_dong_tien.md).

## 0. Tổng quan

| Hạng mục | Số lượng |
|---|---|
| Operation trong OpenAPI runtime (trước thay đổi phường/xã) | 155 = 153 nghiệp vụ + 2 health |
| Sau khi thay 5 API quận bằng 2 API phường/xã chỉ đọc | 152 = 150 nghiệp vụ + 2 health |
| Endpoint VNPAY native ngoài OpenAPI (`include_in_schema=False`) | 2 (IPN, Return) |
| Operation có trong hợp đồng đích nhưng **chưa có** ở runtime | 1: `queryChatbot` (`POST /chatbot/queries`) |
| Mã quyền (`app_function`) | 33 trong seed; còn 32 khi gỡ `district.manage` |

> **Thay đổi đang thực hiện (13/11/2026):** chức năng "Quản lý quận" (`listDistricts`, `createDistrict`, `getDistrict`, `updateDistrict`, `deleteDistrict`, quyền `district.manage`) **bị loại bỏ** và thay bằng danh mục **phường/xã/đặc khu TP.HCM** (168 đơn vị sau sáp nhập 01/7/2025) chỉ đọc, nạp bởi migration `0010`. Đại lý dùng `wardId`; quy định "tối đa N đại lý mỗi quận" thành "mỗi phường/xã" (`maxAgenciesPerWard`, mặc định 4); lỗi `DISTRICT_CAPACITY_EXCEEDED` thành `WARD_CAPACITY_EXCEEDED`. Tại thời điểm đối chiếu, backend vẫn đang mount router quận và giao diện còn liên kết `/districts` trong menu và bộ lọc báo cáo; tài liệu này ghi nhận **hình thức mới** theo [GOAL phường/xã](../openwiki/backend-design/plan/wards/GOAL.md).

## 1. Xác thực và tài khoản

| # | Chức năng | operationId | Method + path | Quyền | Giao diện |
|---|---|---|---|---|---|
| 1 | Đăng nhập | `login` | `POST /auth/login` | Công khai | Có (`/login`) |
| 2 | Làm mới phiên | `refreshTokens` | `POST /auth/refresh` | Refresh token | Hệ thống |
| 3 | Đăng xuất | `logout` | `POST /auth/logout` | Đã đăng nhập | Có |
| 4 | Thông tin người dùng hiện tại | `getCurrentUser` | `GET /auth/me` | Đã đăng nhập | Hệ thống (`/profile`, menu theo quyền) |
| 5 | Đổi mật khẩu | `changePassword` | `PUT /auth/password` | Đã đăng nhập | Có (hộp thoại đổi mật khẩu) |
| 6 | Yêu cầu đặt lại mật khẩu | `requestPasswordReset` | `POST /auth/password-reset-requests` | Công khai | Có (`/forgot-password`) |
| 7 | Đặt lại mật khẩu bằng token | `resetPasswordWithToken` | `POST /auth/password-resets` | Token email | Có (`/reset-password`) |

## 2. Quản trị hệ thống

| # | Chức năng | operationId | Method + path | Quyền | Giao diện |
|---|---|---|---|---|---|
| 1 | Danh sách nhóm người dùng | `listUserGroups` | `GET /user-groups` | anyOf `groups.manage`, `users.manage`, `permissions.manage` | Có (`/user-groups`) |
| 2 | Tạo nhóm | `createUserGroup` | `POST /user-groups` | `groups.manage` | Có |
| 3 | Xem nhóm | `getUserGroup` | `GET /user-groups/{groupId}` | anyOf như #1 | Có |
| 4 | Sửa nhóm | `updateUserGroup` | `PATCH /user-groups/{groupId}` | `groups.manage` | Có |
| 5 | Xóa nhóm (chưa dùng) | `deleteUserGroup` | `DELETE /user-groups/{groupId}` | allOf `groups.manage`, `permissions.manage` | Có |
| 6 | Danh sách tài khoản | `listUsers` | `GET /users` | `users.manage` | Có (`/users`) |
| 7 | Tạo tài khoản | `createUser` | `POST /users` | `users.manage` | Có |
| 8 | Xem tài khoản | `getUser` | `GET /users/{userId}` | `users.manage` | Có |
| 9 | Sửa tài khoản (nhóm, trạng thái khóa…) | `updateUser` | `PATCH /users/{userId}` | `users.manage` | Có |
| 10 | Quản trị đặt lại mật khẩu | `resetUserPassword` | `POST /users/{userId}/password-reset` | `users.manage` | Có |
| 11 | Danh sách chức năng (mã quyền) | `listFunctions` | `GET /functions` | `permissions.manage` | Có (`/permissions`) |
| 12 | Xem một chức năng | `getFunction` | `GET /functions/{functionId}` | `permissions.manage` | Không |
| 13 | Quyền của nhóm | `listGroupPermissions` | `GET /user-groups/{groupId}/permissions` | `permissions.manage` | Có |
| 14 | Xem một quyền của nhóm | `getGroupPermission` | `GET /user-groups/{groupId}/permissions/{functionId}` | `permissions.manage` | Có |
| 15 | Bật/tắt quyền | `setGroupPermission` | `PUT /user-groups/{groupId}/permissions/{functionId}` | `permissions.manage` | Có |
| 16 | Nhật ký hệ thống | `listAuditLogs` | `GET /audit-logs` | `audit.read` | Có (`/audit-logs`) |
| 17 | Chi tiết nhật ký | `getAuditLog` | `GET /audit-logs/{auditId}` | `audit.read` | Có |

Không có API xóa tài khoản (chỉ khóa bằng `updateUser`).

## 3. Danh mục và quy định

| # | Chức năng | operationId | Method + path | Quyền | Giao diện |
|---|---|---|---|---|---|
| 1 | Xem quy định | `getBusinessRules` | `GET /business-rules` | anyOf `rules.manage`, `agency.manage`, `stock.issue.prepare`, `inventory.read` | Có (`/business-rules`) |
| 2 | Thay đổi quy định (số đại lý tối đa mỗi phường/xã, tỷ lệ giá bán) | `updateBusinessRules` | `PATCH /business-rules` | `rules.manage` | Có |
| 3 | **Danh mục phường/xã TP.HCM** (mới, chỉ đọc) | `listWards` | `GET /wards` (`limit, cursor, q, code, kind, sort`) | anyOf `agency.read`, `agency.manage` | Có (ô chọn phường/xã ở hồ sơ đại lý, bộ lọc dashboard) |
| 4 | Xem phường/xã (mới) | `getWard` | `GET /wards/{wardId}` | anyOf `agency.read`, `agency.manage` | Có |
| 5 | Danh sách loại đại lý | `listAgencyTypes` | `GET /agency-types` | anyOf `agency_type.manage`, `agency.read`, `agency.manage` | Có (`/agency-types`) |
| 6 | Tạo loại đại lý (hạn mức nợ) | `createAgencyType` | `POST /agency-types` | `agency_type.manage` | Có |
| 7 | Xem loại đại lý | `getAgencyType` | `GET /agency-types/{typeId}` | anyOf như #5 | Có |
| 8 | Sửa loại đại lý / ngừng sử dụng | `updateAgencyType` | `PATCH /agency-types/{typeId}` | `agency_type.manage` | Có |
| 9 | Xóa loại đại lý chưa dùng | `deleteAgencyType` | `DELETE /agency-types/{typeId}` | `agency_type.manage` | Có |
| 10 | Danh sách đơn vị tính | `listUnits` | `GET /units` | anyOf `unit.manage`, `product.manage`, `inventory.read` | Có (`/units`) |
| 11 | Tạo đơn vị tính | `createUnit` | `POST /units` | `unit.manage` | Có |
| 12 | Xem đơn vị tính | `getUnit` | `GET /units/{unitId}` | anyOf như #10 | Có |
| 13 | Sửa đơn vị tính | `updateUnit` | `PATCH /units/{unitId}` | `unit.manage` | Có |
| 14 | Xóa đơn vị tính chưa dùng | `deleteUnit` | `DELETE /units/{unitId}` | `unit.manage` | Có |
| 15 | Danh sách mặt hàng (kèm tồn, giá nhập, giá bán hiện tại) | `listProducts` | `GET /products` | anyOf `product.manage`, `inventory.read` | Có (`/products`, `/inventory`) |
| 16 | Tạo mặt hàng | `createProduct` | `POST /products` | `product.manage` | Có |
| 17 | Xem mặt hàng | `getProduct` | `GET /products/{productId}` | anyOf như #15 | Có |
| 18 | Sửa mặt hàng | `updateProduct` | `PATCH /products/{productId}` | `product.manage` | Có |
| 19 | Xóa mặt hàng chưa phát sinh | `deleteProduct` | `DELETE /products/{productId}` | `product.manage` | Có |

**Không còn là chức năng hiện hành:** `listDistricts`, `createDistrict`, `getDistrict`, `updateDistrict`, `deleteDistrict` (quyền `district.manage`) — được thay bằng #3–#4.

## 4. Đại lý

| # | Chức năng | operationId | Method + path | Quyền | Giao diện |
|---|---|---|---|---|---|
| 1 | Tra cứu đại lý (lọc theo loại, phường/xã, công nợ…) | `listAgencies` | `GET /agencies` | anyOf `agency.read`, `agency.manage` | Có (`/agencies`) |
| 2 | Tiếp nhận đại lý (BM1) | `createAgency` | `POST /agencies` | `agency.manage` | Có |
| 3 | Xem hồ sơ đại lý | `getAgency` | `GET /agencies/{agencyId}` | anyOf như #1 | Có |
| 4 | Cập nhật hồ sơ, đổi loại, đổi phường/xã | `updateAgency` | `PATCH /agencies/{agencyId}` | `agency.manage` | Có |
| 5 | Xóa đại lý chưa phát sinh giao dịch | `deleteAgency` | `DELETE /agencies/{agencyId}` | `agency.manage` | Không |
| 6 | Ngừng hợp tác (không mở lại) | `terminateAgency` | `POST /agencies/{agencyId}/terminate` | `agency.manage` | Có |

## 5. Kho hàng

| # | Chức năng | operationId | Method + path | Quyền | Giao diện |
|---|---|---|---|---|---|
| 1 | Thẻ kho của mặt hàng | `listProductInventoryEntries` | `GET /products/{productId}/inventory-entries` | `inventory.read` | Có (`/inventory`) |
| 2 | Danh sách phiếu nhập | `listStockReceipts` | `GET /stock-receipts` | anyOf `stock.receipt.prepare`, `stock.receipt.post`, `inventory.read` | Có (`/stock-receipts`) |
| 3 | Lập phiếu nhập (BM2) | `createStockReceipt` | `POST /stock-receipts` | `stock.receipt.prepare` | Có |
| 4 | Xem phiếu nhập | `getStockReceipt` | `GET /stock-receipts/{documentId}` | anyOf như #2 | Có |
| 5 | Sửa nháp phiếu nhập | `updateStockReceiptDraft` | `PATCH /stock-receipts/{documentId}` | `stock.receipt.prepare` | Có |
| 6 | Ghi sổ phiếu nhập | `postStockReceipt` | `POST /stock-receipts/{documentId}/post` | `stock.receipt.post` | Có |
| 7 | Sửa phiếu nhập đã ghi sổ | `correctStockReceipt` | `POST /stock-receipts/{documentId}/corrections` | allOf `documents.correct`, `stock.receipt.post` | Có (hộp thoại sửa sai, `/document-corrections`) |
| 8 | Hủy phiếu nhập | `cancelStockReceipt` | `POST /stock-receipts/{documentId}/cancel` | `documents.cancel` | Có |
| 9 | Danh sách điều chỉnh kho | `listStockAdjustments` | `GET /stock-adjustments` | anyOf `stock.adjustment.prepare`, `stock.adjustment.post`, `inventory.read` | Có (`/stock-adjustments`) |
| 10 | Lập điều chỉnh kho | `createStockAdjustment` | `POST /stock-adjustments` | `stock.adjustment.prepare` | Có |
| 11 | Xem điều chỉnh | `getStockAdjustment` | `GET /stock-adjustments/{documentId}` | anyOf như #9 | Có |
| 12 | Sửa nháp điều chỉnh | `updateStockAdjustmentDraft` | `PATCH /stock-adjustments/{documentId}` | `stock.adjustment.prepare` | Có |
| 13 | Duyệt (ghi sổ) điều chỉnh | `postStockAdjustment` | `POST /stock-adjustments/{documentId}/post` | `stock.adjustment.post` | Có |
| 14 | Sửa điều chỉnh đã ghi sổ | `correctStockAdjustment` | `POST /stock-adjustments/{documentId}/corrections` | allOf `documents.correct`, `stock.adjustment.post` | Có (trừ điều chỉnh sinh từ kiểm kê) |
| 15 | Hủy điều chỉnh | `cancelStockAdjustment` | `POST /stock-adjustments/{documentId}/cancel` | `documents.cancel` | Có |
| 16 | Danh sách phiếu kiểm kê | `listStockCounts` | `GET /stock-counts` | `stock.count` | Có (`/stock-counts`) |
| 17 | Tạo phiếu kiểm kê | `createStockCount` | `POST /stock-counts` | `stock.count` | Có |
| 18 | Xem phiếu kiểm kê | `getStockCount` | `GET /stock-counts/{countId}` | `stock.count` | Có |
| 19 | Sửa nháp kiểm kê | `updateStockCountDraft` | `PATCH /stock-counts/{countId}` | `stock.count` | Có |
| 20 | Danh sách dòng kiểm kê | `listStockCountLines` | `GET /stock-counts/{countId}/lines` | `stock.count` | Không gọi riêng |
| 21 | Thêm dòng kiểm kê | `createStockCountLine` | `POST /stock-counts/{countId}/lines` | `stock.count` | Có |
| 22 | Xem dòng kiểm kê | `getStockCountLine` | `GET /stock-counts/{countId}/lines/{lineId}` | `stock.count` | Không gọi riêng |
| 23 | Sửa dòng kiểm kê | `updateStockCountLine` | `PATCH /stock-counts/{countId}/lines/{lineId}` | `stock.count` | Có |
| 24 | Kiểm lại số sách | `recountStock` | `POST /stock-counts/{countId}/recount` | `stock.count` | Có |
| 25 | Xác nhận kiểm kê (sinh điều chỉnh khi lệch) | `confirmStockCount` | `POST /stock-counts/{countId}/confirm` | `stock.count`; thêm `stock.adjustment.post` khi có chênh lệch | Có |

## 6. Bán hàng và trả hàng

| # | Chức năng | operationId | Method + path | Quyền | Giao diện |
|---|---|---|---|---|---|
| 1 | Danh sách phiếu xuất | `listStockIssues` | `GET /stock-issues` | anyOf `stock.issue.prepare`, `stock.issue.post`, `debt.read`, `sales.read` | Có (`/stock-issues`) |
| 2 | Lập phiếu xuất (BM3) | `createStockIssue` | `POST /stock-issues` | `stock.issue.prepare` | Có |
| 3 | Xem phiếu xuất | `getStockIssue` | `GET /stock-issues/{documentId}` | anyOf như #1 | Có |
| 4 | Sửa nháp phiếu xuất | `updateStockIssueDraft` | `PATCH /stock-issues/{documentId}` | `stock.issue.prepare` | Có |
| 5 | Nộp phiếu xuất (đóng băng giá, kiểm hạn mức) | `submitStockIssue` | `POST /stock-issues/{documentId}/submit` | `stock.issue.prepare` | Có |
| 6 | Thay phiên bản phiếu đang chờ | `replacePendingStockIssue` | `POST /stock-issues/{documentId}/revisions` | `stock.issue.prepare` | Có |
| 7 | Ghi sổ phiếu xuất (tự sinh phiếu thu nếu trả ngay) | `postStockIssue` | `POST /stock-issues/{documentId}/post` | `stock.issue.post` | Có |
| 8 | Sửa phiếu xuất đã ghi sổ | `correctStockIssue` | `POST /stock-issues/{documentId}/corrections` | allOf `documents.correct`, `stock.issue.post` | Có |
| 9 | Hủy phiếu xuất | `cancelStockIssue` | `POST /stock-issues/{documentId}/cancel` | `documents.cancel`; thêm `cash.receipt.post` nếu có tiền trả ngay cần tách | Có |
| 10 | Danh sách phiếu trả hàng | `listSalesReturns` | `GET /sales-returns` | anyOf `returns.prepare`, `returns.post`, `debt.read`, `sales.read` | Có (`/sales-returns`) |
| 11 | Lập phiếu trả hàng | `createSalesReturn` | `POST /sales-returns` | `returns.prepare` | Có |
| 12 | Xem phiếu trả hàng | `getSalesReturn` | `GET /sales-returns/{documentId}` | anyOf như #10 | Có |
| 13 | Sửa nháp trả hàng | `updateSalesReturnDraft` | `PATCH /sales-returns/{documentId}` | `returns.prepare` | Có |
| 14 | Ghi sổ trả hàng | `postSalesReturn` | `POST /sales-returns/{documentId}/post` | `returns.post` | Có |
| 15 | Sửa phiếu trả hàng đã ghi sổ | `correctSalesReturn` | `POST /sales-returns/{documentId}/corrections` | allOf `documents.correct`, `returns.post` | Có |
| 16 | Hủy phiếu trả hàng | `cancelSalesReturn` | `POST /sales-returns/{documentId}/cancel` | `documents.cancel` | Có |

## 7. Thu tiền, công nợ và dư có

| # | Chức năng | operationId | Method + path | Quyền | Giao diện |
|---|---|---|---|---|---|
| 1 | Danh sách phiếu thu | `listPaymentReceipts` | `GET /payment-receipts` | anyOf `cash.receipt.prepare`, `cash.receipt.post`, `debt.read` | Có (`/payment-receipts`) |
| 2 | Lập phiếu thu công nợ (BM5) | `createPaymentReceipt` | `POST /payment-receipts` | `cash.receipt.prepare` | Có |
| 3 | Xem phiếu thu | `getPaymentReceipt` | `GET /payment-receipts/{documentId}` | anyOf như #1 | Có |
| 4 | Sửa nháp phiếu thu | `updatePaymentReceiptDraft` | `PATCH /payment-receipts/{documentId}` | `cash.receipt.prepare` | Không |
| 5 | Ghi sổ phiếu thu | `postPaymentReceipt` | `POST /payment-receipts/{documentId}/post` | `cash.receipt.post` | Có |
| 6 | Sửa phiếu thu thủ công đã ghi sổ | `correctPaymentReceipt` | `POST /payment-receipts/{documentId}/corrections` | allOf `documents.correct`, `cash.receipt.post` | Có (`/document-corrections`) |
| 7 | Hủy phiếu thu thủ công | `cancelPaymentReceipt` | `POST /payment-receipts/{documentId}/cancel` | `documents.cancel` | Có |
| 8 | Danh sách xác nhận trả ngay | `listUpfrontConfirmations` | `GET /upfront-confirmations` | anyOf `cash.upfront.verify`, `cash.receipt.post`, `stock.issue.post` | Có (`/upfront-payments`) |
| 9 | Xác nhận đã nhận tiền trả ngay | `verifyUpfrontPayment` | `POST /upfront-confirmations` | `cash.upfront.verify` | Có |
| 10 | Xem xác nhận trả ngay | `getUpfrontConfirmation` | `GET /upfront-confirmations/{confirmationId}` | anyOf như #8 | Có |
| 11 | Tách tiền trả ngay thành phiếu thu riêng | `receiveUpfrontSeparately` | `POST /upfront-confirmations/{confirmationId}/receive-separately` | `cash.receipt.post` | Có |
| 12 | Tổng hợp công nợ đại lý | `listReceivables` | `GET /receivables` | `debt.read` | Có (`/receivables`) |
| 13 | Số dư đại lý (nợ, dư có, khả dụng, hạn mức còn lại) | `getAgencyBalance` | `GET /agencies/{agencyId}/balance` | anyOf `debt.read`, `credit.apply`, `cash.refund.post` | Có |
| 14 | Số dư từng phiếu xuất của đại lý | `listAgencyInvoiceBalances` | `GET /agencies/{agencyId}/invoice-balances` | `debt.read` | Có |
| 15 | Số dư một phiếu xuất | `getInvoiceBalance` | `GET /stock-issues/{documentId}/balance` | `debt.read` | Không |
| 16 | Sổ chi tiết phải thu | `listAgencyReceivableEntries` | `GET /agencies/{agencyId}/receivable-entries` | `debt.read` | Có |
| 17 | Phân bổ của một chứng từ | `listDocumentAllocations` | `GET /documents/{documentId}/allocations` | `debt.read` | Không |
| 18 | Danh sách lô dư có | `listAgencyCreditLots` | `GET /agencies/{agencyId}/credit-lots` | anyOf `debt.read`, `credit.apply`, `cash.refund.post` | Có (`/agency-credit`) |
| 19 | Xem lô dư có | `getCreditLot` | `GET /credit-lots/{lotId}` | anyOf như #18 | Không |
| 20 | Sổ chi tiết dư có | `listAgencyCreditEntries` | `GET /agencies/{agencyId}/credit-entries` | `debt.read` | Có |
| 21 | Danh sách bù trừ dư có | `listCreditApplications` | `GET /credit-applications` | anyOf `credit.apply`, `debt.read` | Có (`/credit-applications`) |
| 22 | Lập bù trừ dư có | `createCreditApplication` | `POST /credit-applications` | `credit.apply` | Có |
| 23 | Xem bù trừ | `getCreditApplication` | `GET /credit-applications/{documentId}` | anyOf như #21 | Có |
| 24 | Sửa nháp bù trừ | `updateCreditApplicationDraft` | `PATCH /credit-applications/{documentId}` | `credit.apply` | Không |
| 25 | Ghi sổ bù trừ | `postCreditApplication` | `POST /credit-applications/{documentId}/post` | `credit.apply` | Có |
| 26 | Sửa bù trừ đã ghi sổ | `correctCreditApplication` | `POST /credit-applications/{documentId}/corrections` | allOf `documents.correct`, `credit.apply` | Có (`/document-corrections`) |
| 27 | Hủy bù trừ | `cancelCreditApplication` | `POST /credit-applications/{documentId}/cancel` | `documents.cancel` | Có (`/document-corrections`) |

## 8. Thanh toán trực tuyến và hoàn tiền

| # | Chức năng | operationId | Method + path | Quyền | Giao diện |
|---|---|---|---|---|---|
| 1 | Danh sách thanh toán trực tuyến | `listOnlinePayments` | `GET /online-payments` | anyOf `payments.online`, `debt.read` | Có (`/online-payments`) |
| 2 | Khởi tạo thanh toán VNPAY (BM15) | `createOnlinePayment` | `POST /online-payments` | `payments.online` | Có |
| 3 | Xem giao dịch | `getOnlinePayment` | `GET /online-payments/{paymentId}` | anyOf như #1 | Có |
| 4 | Sự kiện provider đã xác minh | `listPaymentEvents` | `GET /online-payments/{paymentId}/events` | `payments.online` | Có |
| 5 | Đối soát giao dịch với provider | `reconcileOnlinePayment` | `POST /online-payments/{paymentId}/reconcile` | `payments.online` | Có |
| 6 | Webhook provider sandbox chung (HMAC) | `receiveVerifiedPaymentWebhook` | `POST /payment-webhooks/{provider}` | Chữ ký HMAC, không dùng JWT | Hệ thống |
| 7 | IPN VNPAY (ngoài OpenAPI) | — | `GET /integrations/vnpay/ipn` | Chữ ký SHA512 VNPAY | Hệ thống |
| 8 | Trang trở về từ VNPAY (ngoài OpenAPI) | — | `GET /integrations/vnpay/return` | Chữ ký SHA512; không ghi nhận tiền | Hệ thống (dẫn về `/online-payments`) |
| 9 | Danh sách phiếu hoàn tiền | `listRefunds` | `GET /refunds` | anyOf `cash.refund.prepare`, `cash.refund.post`, `debt.read` | Có (`/refunds`) |
| 10 | Lập phiếu hoàn tiền | `createRefund` | `POST /refunds` | `cash.refund.prepare` | Có |
| 11 | Xem phiếu hoàn tiền | `getRefund` | `GET /refunds/{documentId}` | anyOf như #9 | Có |
| 12 | Sửa nháp hoàn tiền | `updateRefundDraft` | `PATCH /refunds/{documentId}` | `cash.refund.prepare` | Không |
| 13 | Giữ chỗ dư có (nộp) | `submitRefund` | `POST /refunds/{documentId}/submit` | `cash.refund.post` | Có |
| 14 | Xác nhận đã chi (tiền mặt/chuyển khoản) | `confirmManualRefundPaid` | `POST /refunds/{documentId}/confirm-paid` | `cash.refund.post` | Có |
| 15 | Hủy phiếu hoàn chưa chi | `cancelUnpaidRefund` | `POST /refunds/{documentId}/cancel` | allOf `documents.cancel`, `cash.refund.post` | Có |
| 16 | Danh sách lần thử hoàn trực tuyến | `listRefundAttempts` | `GET /refunds/{documentId}/attempts` | anyOf `cash.refund.post`, `debt.read` | Không (chi tiết phiếu đã kèm lần thử mới nhất) |
| 17 | Gửi hoàn tiền trực tuyến | `requestOnlineRefund` | `POST /refunds/{documentId}/attempts` | `cash.refund.post` | Có (lần đầu; thử lại sau `FAILED` chưa có nút) |
| 18 | Xem lần thử hoàn | `getRefundAttempt` | `GET /refund-attempts/{attemptId}` | anyOf `cash.refund.post`, `debt.read` | Không |
| 19 | Đối soát lần thử hoàn | `reconcileRefundAttempt` | `POST /refund-attempts/{attemptId}/reconcile` | `cash.refund.post` | Có |
| 20 | Danh sách giữ chỗ của phiếu hoàn | `listRefundReservations` | `GET /refunds/{documentId}/reservations` | anyOf `cash.refund.post`, `debt.read` | Không (chi tiết phiếu có tổng giữ chỗ) |

## 9. Lịch sử chứng từ

| # | Chức năng | operationId | Method + path | Quyền | Giao diện |
|---|---|---|---|---|---|
| 1 | Tìm chứng từ mọi loại | `searchDocuments` | `GET /documents` | Quyền đọc theo từng loại chứng từ | Có (`/document-history`, `/document-corrections`) |
| 2 | Các phiên bản của chứng từ | `listDocumentRevisions` | `GET /documents/{documentId}/revisions` | Quyền đọc của loại | Có |
| 3 | Xem một phiên bản | `getDocumentRevision` | `GET /documents/{documentId}/revisions/{revisionNo}` | Quyền đọc của loại | Không gọi riêng |
| 4 | Dòng hàng của phiên bản | `listDocumentLines` | `GET /documents/{documentId}/revisions/{revisionNo}/lines` | Quyền đọc của loại | Không gọi riêng |
| 5 | Thêm dòng vào nháp | `createDocumentLine` | `POST /documents/{documentId}/revisions/{revisionNo}/lines` | Quyền `*.prepare` theo loại | Không (giao diện gửi toàn bộ dòng khi lập/sửa phiếu) |
| 6 | Xem dòng | `getDocumentLine` | `GET …/lines/{lineId}` | Quyền đọc của loại | Không |
| 7 | Thay dòng nháp | `replaceDocumentLine` | `PUT …/lines/{lineId}` | Quyền `*.prepare` theo loại | Không |
| 8 | Xóa dòng nháp | `deleteDocumentLine` | `DELETE …/lines/{lineId}` | Quyền `*.prepare` theo loại | Không |
| 9 | In chứng từ (PDF) | `printDocument` | `GET /documents/{documentId}/print` | Quyền đọc của loại | Có |

## 10. Báo cáo và tổng quan

| # | Chức năng | operationId | Method + path | Quyền | Giao diện |
|---|---|---|---|---|---|
| 1 | Báo cáo doanh số (BM6.1) | `getSalesReport` | `GET /reports/sales` | allOf `reports.read`, `sales.read` | Có (`/reports`, xuất tệp) |
| 2 | Báo cáo công nợ (BM6.2), lọc theo phường/xã | `getDebtReport` | `GET /reports/debt` | allOf `reports.read`, `debt.read` | Có |
| 3 | Báo cáo nhập-xuất-tồn | `getInventoryReport` | `GET /reports/inventory` | allOf `reports.read`, `inventory.read` | Có |
| 4 | Doanh số theo mặt hàng | `getProductSalesReport` | `GET /reports/product-sales` | allOf `reports.read`, `sales.read` | Có |
| 5 | Thu tiền và dư có | `getCashAndCreditReport` | `GET /reports/cash-and-credit` | allOf `reports.read`, `debt.read` | Có |
| 6 | Bảng điều khiển | `getDashboard` | `GET /dashboard` | anyOf `agency.read`, `inventory.read`, `sales.read`, `debt.read`, `stock.issue.post`, `cash.upfront.verify` (mỗi khối hiển thị theo quyền) | Có (`/dashboard`) |
| 7 | Tra cứu qua chatbot (BM16) | `queryChatbot` | `POST /chatbot/queries` | — | **Chưa có** ở backend; menu "Trợ lý AI" bị đánh dấu chưa khả dụng |

## 11. Hệ thống

| # | Chức năng | Method + path | Quyền |
|---|---|---|---|
| 1 | Liveness | `GET /health` | Công khai |
| 2 | Readiness (kiểm tra database) | `GET /health/ready` | Công khai |

## 12. Mã quyền và nhóm mặc định

Seed ban đầu (`backend/alembic/sql/0001_initial.sql:1495-1516`). Nhóm **Quản lý** có mọi quyền. Phân quyền thực tế có thể đã được sửa qua chức năng Phân quyền.

| Mã quyền | Tên | Kinh doanh | Kho | Kế toán |
|---|---|:-:|:-:|:-:|
| `users.manage` | Quản lý tài khoản | | | |
| `groups.manage` | Quản lý nhóm | | | |
| `permissions.manage` | Phân quyền | | | |
| `rules.manage` | Thay đổi quy định | | | |
| ~~`district.manage`~~ | ~~Quản lý quận~~ — gỡ bỏ cùng migration `0010` | | | |
| `agency_type.manage` | Quản lý loại đại lý | | | |
| `unit.manage` | Quản lý đơn vị tính | | x | |
| `product.manage` | Quản lý mặt hàng | | x | |
| `agency.read` | Tra cứu đại lý | x | x | x |
| `agency.manage` | Tiếp nhận/cập nhật đại lý | x | | |
| `inventory.read` | Tra cứu tồn kho | x | x | |
| `stock.receipt.prepare` | Lập phiếu nhập | | x | |
| `stock.receipt.post` | Xác nhận nhập | | x | |
| `stock.issue.prepare` | Lập phiếu xuất | x | | |
| `stock.issue.post` | Xác nhận xuất | | x | |
| `cash.receipt.prepare` | Lập phiếu thu | | | x |
| `cash.receipt.post` | Xác nhận thu | | | x |
| `cash.upfront.verify` | Xác nhận khoản trả ngay | | | x |
| `stock.count` | Kiểm kê | | x | |
| `stock.adjustment.prepare` | Lập điều chỉnh kho | | x | |
| `stock.adjustment.post` | Duyệt điều chỉnh kho | | | |
| `returns.prepare` | Lập trả hàng | | x | |
| `returns.post` | Xác nhận trả hàng | | x | |
| `cash.refund.prepare` | Lập hoàn tiền | | | x |
| `cash.refund.post` | Xác nhận hoàn tiền | | | x |
| `credit.apply` | Bù trừ dư có | | | x |
| `documents.correct` | Sửa chứng từ đã xác nhận | | | |
| `documents.cancel` | Hủy chứng từ | | | |
| `sales.read` | Tra cứu doanh số | x | | x |
| `debt.read` | Tra cứu công nợ | x | | x |
| `reports.read` | Báo cáo | | | x |
| `audit.read` | Nhật ký | | | |
| `payments.online` | Thanh toán sandbox | | | x |

## 13. Màn hình giao diện không gắn một API nghiệp vụ riêng

| Route | Nội dung |
|---|---|
| `/` | Bàn làm việc: lối tắt theo quyền |
| `/profile` | Hồ sơ người dùng (dùng `getCurrentUser`, `changePassword`) |
| `/document-corrections` | Màn hình tập trung sửa/hủy mọi loại chứng từ trừ hoàn tiền; gọi các API `correct*`/`cancel*` ở trên |
| `/chatbot` | Trợ lý AI — chưa khả dụng |

## 14. Ghi chú đối chiếu

- Các API "Không" vẫn hoạt động và có thể dùng qua Swagger (`/api/docs`); chúng chủ yếu là API đọc chi tiết hoặc chỉnh sửa nháp cho phiếu tài chính. Với phiếu thu, bù trừ, hoàn tiền, giao diện hiện tạo phiếu mới thay vì sửa nháp.
- Thử lại hoàn tiền trực tuyến sau `FAILED` chỉ có ở backend (`requestOnlineRefund` tạo phiên bản mới); giao diện chưa có lối đi (xem tài liệu 06, mục 17).
- Việc xác định "Có/Không" dựa trên đọc mã giao diện, chưa kiểm tra bằng trình duyệt.
- Giao diện đang được cập nhật đồng thời cho phường/xã: tại thời điểm đọc, menu và bộ lọc báo cáo còn tham chiếu `/districts`, còn hồ sơ đại lý và dashboard đã dùng `/wards`.
