# Full frontend — Operations

**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.

## Unique source operation → frontend disposition

Method/path and First/Full are indexed from the reviewed [backend inventory](../../../backend-design/plan/full_backend/OPERATIONS.md); consult the [OpenAPI](../../../backend-design/API/openapi.json) for current schemas, security, parameter requirements and content negotiation. One operation appears once below. F14/F19/F24/F29 consumer relationships are indexed in their owning child REQUIREMENTS; one shared agency balance and one provider-only webhook are not duplicated. Full gate is a lower bound, not automatic live availability.

| operationId | Method and path | Frontend owner/disposition | Backend First/Full | Primary wireframe |
| --- | --- | --- | --- | --- |
| `login` | POST `/auth/login` | F02 authentication | M01/M01 | [Đăng nhập](../../wr/authentication/index.html) |
| `refreshTokens` | POST `/auth/refresh` | F02 authentication | M01/M01 | [Phiên đăng nhập](../../wr/authentication/session.html) |
| `logout` | POST `/auth/logout` | F02 authentication | M01/M01 | [Phiên đăng nhập](../../wr/authentication/session.html) |
| `getCurrentUser` | GET `/auth/me` | F02 authentication | M01/M01 | [Phiên đăng nhập](../../wr/authentication/session.html) |
| `changePassword` | PUT `/auth/password` | F02 authentication | M01/M01 | [Đổi mật khẩu](../../wr/authentication/change-password.html) |
| `requestPasswordReset` | POST `/auth/password-reset-requests` | F02 authentication | M01/M01 | [Quên mật khẩu](../../wr/authentication/forgot-password.html) |
| `resetPasswordWithToken` | POST `/auth/password-resets` | F02 authentication | M01/M01 | [Đặt lại mật khẩu](../../wr/authentication/reset-password.html) |
| `listUserGroups` | GET `/user-groups` | F04 user_groups | M03/M03 | [Nhóm nhân viên](../../wr/user_groups/index.html) |
| `createUserGroup` | POST `/user-groups` | F04 user_groups | M03/M03 | [Tạo hoặc sửa nhóm](../../wr/user_groups/editor.html) |
| `getUserGroup` | GET `/user-groups/{groupId}` | F04 user_groups | M03/M03 | [Chi tiết nhóm](../../wr/user_groups/detail.html) |
| `updateUserGroup` | PATCH `/user-groups/{groupId}` | F04 user_groups | M03/M03 | [Tạo hoặc sửa nhóm](../../wr/user_groups/editor.html) |
| `deleteUserGroup` | DELETE `/user-groups/{groupId}` | F04 user_groups | M03/M03 | [Nhóm nhân viên](../../wr/user_groups/index.html) |
| `listUsers` | GET `/users` | F05 users | M04/M04 | [Tài khoản nhân viên](../../wr/users/index.html) |
| `createUser` | POST `/users` | F05 users | M04/M04 | [Tạo hoặc cập nhật nhân viên](../../wr/users/editor.html) |
| `getUser` | GET `/users/{userId}` | F05 users | M04/M04 | [Chi tiết tài khoản](../../wr/users/detail.html) |
| `updateUser` | PATCH `/users/{userId}` | F05 users | M04/M04 | [Tạo hoặc cập nhật nhân viên](../../wr/users/editor.html) |
| `resetUserPassword` | POST `/users/{userId}/password-reset` | F05 users | M04/M04 | [Đặt lại mật khẩu nhân viên](../../wr/users/password-reset.html) |
| `listFunctions` | GET `/functions` | F06 permissions | M05/M05 | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `getFunction` | GET `/functions/{functionId}` | F06 permissions | M05/M05 | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `listGroupPermissions` | GET `/user-groups/{groupId}/permissions` | F06 permissions | M05/M05 | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `getGroupPermission` | GET `/user-groups/{groupId}/permissions/{functionId}` | F06 permissions | M05/M05 | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `setGroupPermission` | PUT `/user-groups/{groupId}/permissions/{functionId}` | F06 permissions | M05/M05 | [Cập nhật quyền](../../wr/permissions/grant.html) |
| `listAuditLogs` | GET `/audit-logs` | F07 audit_logs | M06/M06 | [Nhật ký hệ thống](../../wr/audit_logs/index.html) |
| `getAuditLog` | GET `/audit-logs/{auditId}` | F07 audit_logs | M06/M06 | [Chi tiết thay đổi](../../wr/audit_logs/detail.html) |
| `listDistricts` | GET `/districts` | F08 districts | M07/M07 | [Quận](../../wr/districts/index.html) |
| `createDistrict` | POST `/districts` | F08 districts | M07/M07 | [Tạo hoặc cập nhật quận](../../wr/districts/editor.html) |
| `getDistrict` | GET `/districts/{districtId}` | F08 districts | M07/M07 | [Chi tiết quận](../../wr/districts/detail.html) |
| `updateDistrict` | PATCH `/districts/{districtId}` | F08 districts | M07/M07 | [Tạo hoặc cập nhật quận](../../wr/districts/editor.html) |
| `deleteDistrict` | DELETE `/districts/{districtId}` | F08 districts | M07/M07 | [Quận](../../wr/districts/index.html) |
| `listAgencyTypes` | GET `/agency-types` | F09 agency_types | M08/M08 | [Loại đại lý](../../wr/agency_types/index.html) |
| `createAgencyType` | POST `/agency-types` | F09 agency_types | M08/M08 | [Tạo hoặc sửa loại đại lý](../../wr/agency_types/editor.html) |
| `getAgencyType` | GET `/agency-types/{typeId}` | F09 agency_types | M08/M08 | [Chi tiết loại đại lý](../../wr/agency_types/detail.html) |
| `updateAgencyType` | PATCH `/agency-types/{typeId}` | F09 agency_types | M08/M08 | [Tạo hoặc sửa loại đại lý](../../wr/agency_types/editor.html) |
| `deleteAgencyType` | DELETE `/agency-types/{typeId}` | F09 agency_types | M08/M08 | [Loại đại lý](../../wr/agency_types/index.html) |
| `listUnits` | GET `/units` | F10 units | M09/M09 | [Đơn vị tính](../../wr/units/index.html) |
| `createUnit` | POST `/units` | F10 units | M09/M09 | [Tạo hoặc sửa đơn vị](../../wr/units/editor.html) |
| `getUnit` | GET `/units/{unitId}` | F10 units | M09/M09 | [Chi tiết đơn vị](../../wr/units/detail.html) |
| `updateUnit` | PATCH `/units/{unitId}` | F10 units | M09/M09 | [Tạo hoặc sửa đơn vị](../../wr/units/editor.html) |
| `deleteUnit` | DELETE `/units/{unitId}` | F10 units | M09/M09 | [Đơn vị tính](../../wr/units/index.html) |
| `getBusinessRules` | GET `/business-rules` | F11 business_rules | M10/M10 | [Quy định hiện hành](../../wr/business_rules/index.html) |
| `updateBusinessRules` | PATCH `/business-rules` | F11 business_rules | M10/M10 | [Sửa quy định](../../wr/business_rules/editor.html) |
| `listProducts` | GET `/products` | F12 products | M11/M11 | [Mặt hàng](../../wr/products/index.html) |
| `createProduct` | POST `/products` | F12 products | M11/M11 | [Tạo hoặc sửa mặt hàng](../../wr/products/editor.html) |
| `getProduct` | GET `/products/{productId}` | F12 products | M11/M11 | [Chi tiết mặt hàng](../../wr/products/detail.html) |
| `updateProduct` | PATCH `/products/{productId}` | F12 products | M11/M11 | [Tạo hoặc sửa mặt hàng](../../wr/products/editor.html) |
| `deleteProduct` | DELETE `/products/{productId}` | F12 products | M11/M11 | [Mặt hàng](../../wr/products/index.html) |
| `listAgencies` | GET `/agencies` | F13 agencies | M12/M12 | [Đại lý](../../wr/agencies/index.html) |
| `createAgency` | POST `/agencies` | F13 agencies | M12/M12 | [Tiếp nhận hoặc sửa đại lý](../../wr/agencies/editor.html) |
| `getAgency` | GET `/agencies/{agencyId}` | F13 agencies | M12/M12 | [Hồ sơ đại lý](../../wr/agencies/detail.html) |
| `updateAgency` | PATCH `/agencies/{agencyId}` | F13 agencies | M12/M12 | [Tiếp nhận hoặc sửa đại lý](../../wr/agencies/editor.html) |
| `deleteAgency` | DELETE `/agencies/{agencyId}` | F13 agencies | M12/M12 | [Đại lý](../../wr/agencies/index.html) |
| `terminateAgency` | POST `/agencies/{agencyId}/terminate` | F13 agencies | M12/M12 | [Ngừng hợp tác](../../wr/agencies/terminate.html) |
| `listProductInventoryEntries` | GET `/products/{productId}/inventory-entries` | F15 inventory | M14/M14 | [Tồn kho](../../wr/inventory/index.html) |
| `listStockReceipts` | GET `/stock-receipts` | F16 stock_receipts | M15/M15 | [Phiếu nhập hàng](../../wr/stock_receipts/index.html) |
| `createStockReceipt` | POST `/stock-receipts` | F16 stock_receipts | M15/M15 | [Lập phiếu nhập](../../wr/stock_receipts/editor.html) |
| `getStockReceipt` | GET `/stock-receipts/{documentId}` | F16 stock_receipts | M15/M15 | [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) |
| `updateStockReceiptDraft` | PATCH `/stock-receipts/{documentId}` | F16 stock_receipts | M15/M15 | [Lập phiếu nhập](../../wr/stock_receipts/editor.html) |
| `postStockReceipt` | POST `/stock-receipts/{documentId}/post` | F16 stock_receipts | M15/M15 | [Xác nhận nhập kho](../../wr/stock_receipts/review.html) |
| `correctStockReceipt` | POST `/stock-receipts/{documentId}/corrections` | F16 stock_receipts | M29/M29 | [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) |
| `cancelStockReceipt` | POST `/stock-receipts/{documentId}/cancel` | F16 stock_receipts | M15/M29 | [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) |
| `listStockIssues` | GET `/stock-issues` | F17 stock_issues | M17/M17 | [Phiếu xuất hàng](../../wr/stock_issues/index.html) |
| `createStockIssue` | POST `/stock-issues` | F17 stock_issues | M17/M17 | [Lập phiếu xuất](../../wr/stock_issues/editor.html) |
| `getStockIssue` | GET `/stock-issues/{documentId}` | F17 stock_issues | M17/M17 | [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) |
| `updateStockIssueDraft` | PATCH `/stock-issues/{documentId}` | F17 stock_issues | M17/M17 | [Lập phiếu xuất](../../wr/stock_issues/editor.html) |
| `submitStockIssue` | POST `/stock-issues/{documentId}/submit` | F17 stock_issues | M17/M17 | [Xác nhận xuất kho](../../wr/stock_issues/review.html) |
| `replacePendingStockIssue` | POST `/stock-issues/{documentId}/revisions` | F17 stock_issues | M17/M19 | [Lập phiếu xuất](../../wr/stock_issues/editor.html) |
| `postStockIssue` | POST `/stock-issues/{documentId}/post` | F17 stock_issues | M17/M19 | [Xác nhận xuất kho](../../wr/stock_issues/review.html) |
| `correctStockIssue` | POST `/stock-issues/{documentId}/corrections` | F17 stock_issues | M29/M29 | [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) |
| `cancelStockIssue` | POST `/stock-issues/{documentId}/cancel` | F17 stock_issues | M17/M29 | [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) |
| `listPaymentReceipts` | GET `/payment-receipts` | F18 payment_receipts | M18/M18 | [Phiếu thu](../../wr/payment_receipts/index.html) |
| `createPaymentReceipt` | POST `/payment-receipts` | F18 payment_receipts | M18/M18 | [Lập phiếu thu công nợ](../../wr/payment_receipts/editor.html) |
| `getPaymentReceipt` | GET `/payment-receipts/{documentId}` | F18 payment_receipts | M18/M18 | [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) |
| `updatePaymentReceiptDraft` | PATCH `/payment-receipts/{documentId}` | F18 payment_receipts | M18/M18 | [Lập phiếu thu công nợ](../../wr/payment_receipts/editor.html) |
| `postPaymentReceipt` | POST `/payment-receipts/{documentId}/post` | F18 payment_receipts | M18/M18 | [Xác nhận tiền đã thu](../../wr/payment_receipts/review.html) |
| `correctPaymentReceipt` | POST `/payment-receipts/{documentId}/corrections` | F18 payment_receipts | M29/M29 | [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) |
| `cancelPaymentReceipt` | POST `/payment-receipts/{documentId}/cancel` | F18 payment_receipts | M18/M29 | [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) |
| `listUpfrontConfirmations` | GET `/upfront-confirmations` | F19 upfront_payments | M19/M19 | [Khoản trả ngay](../../wr/upfront_payments/index.html) |
| `verifyUpfrontPayment` | POST `/upfront-confirmations` | F19 upfront_payments | M19/M19 | [Xác nhận tiền trả ngay](../../wr/upfront_payments/verify.html) |
| `getUpfrontConfirmation` | GET `/upfront-confirmations/{confirmationId}` | F19 upfront_payments | M19/M19 | [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) |
| `receiveUpfrontSeparately` | POST `/upfront-confirmations/{confirmationId}/receive-separately` | F19 upfront_payments | M19/M19 | [Ghi nhận tiền riêng](../../wr/upfront_payments/receive-separately.html) |
| `listReceivables` | GET `/receivables` | F20 receivables | M20/M20 | [Công nợ](../../wr/receivables/index.html) |
| `getAgencyBalance` | GET `/agencies/{agencyId}/balance` | F20 receivables | M20/M20 | [Công nợ đại lý](../../wr/receivables/agency.html) |
| `listAgencyInvoiceBalances` | GET `/agencies/{agencyId}/invoice-balances` | F20 receivables | M20/M20 | [Công nợ phiếu xuất](../../wr/receivables/invoice.html) |
| `getInvoiceBalance` | GET `/stock-issues/{documentId}/balance` | F20 receivables | M20/M20 | [Công nợ phiếu xuất](../../wr/receivables/invoice.html) |
| `listAgencyReceivableEntries` | GET `/agencies/{agencyId}/receivable-entries` | F20 receivables | M20/M20 | [Sổ công nợ](../../wr/receivables/statement.html) |
| `listDocumentAllocations` | GET `/documents/{documentId}/allocations` | F20 receivables | M20/M20 | [Phân bổ thanh toán](../../wr/receivables/allocations.html) |
| `listAgencyCreditLots` | GET `/agencies/{agencyId}/credit-lots` | F24 agency_credit | M24/M24 | [Các lô dư có](../../wr/agency_credit/lots.html) |
| `getCreditLot` | GET `/credit-lots/{lotId}` | F24 agency_credit | M24/M24 | [Nguồn một lô dư có](../../wr/agency_credit/lot.html) |
| `listAgencyCreditEntries` | GET `/agencies/{agencyId}/credit-entries` | F24 agency_credit | M24/M24 | [Sổ dư có](../../wr/agency_credit/statement.html) |
| `listStockAdjustments` | GET `/stock-adjustments` | F21 stock_adjustments | M21/M21 | [Điều chỉnh tồn](../../wr/stock_adjustments/index.html) |
| `createStockAdjustment` | POST `/stock-adjustments` | F21 stock_adjustments | M21/M21 | [Lập phiếu điều chỉnh](../../wr/stock_adjustments/editor.html) |
| `getStockAdjustment` | GET `/stock-adjustments/{documentId}` | F21 stock_adjustments | M21/M21 | [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) |
| `updateStockAdjustmentDraft` | PATCH `/stock-adjustments/{documentId}` | F21 stock_adjustments | M21/M21 | [Lập phiếu điều chỉnh](../../wr/stock_adjustments/editor.html) |
| `postStockAdjustment` | POST `/stock-adjustments/{documentId}/post` | F21 stock_adjustments | M21/M21 | [Xác nhận điều chỉnh](../../wr/stock_adjustments/review.html) |
| `correctStockAdjustment` | POST `/stock-adjustments/{documentId}/corrections` | F21 stock_adjustments | M29/M29 | [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) |
| `cancelStockAdjustment` | POST `/stock-adjustments/{documentId}/cancel` | F21 stock_adjustments | M21/M29 | [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) |
| `listStockCounts` | GET `/stock-counts` | F22 stock_counts | M22/M22 | [Kiểm kê kho](../../wr/stock_counts/index.html) |
| `createStockCount` | POST `/stock-counts` | F22 stock_counts | M22/M22 | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `getStockCount` | GET `/stock-counts/{countId}` | F22 stock_counts | M22/M22 | [Biên bản kiểm kê](../../wr/stock_counts/detail.html) |
| `updateStockCountDraft` | PATCH `/stock-counts/{countId}` | F22 stock_counts | M22/M22 | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `listStockCountLines` | GET `/stock-counts/{countId}/lines` | F22 stock_counts | M22/M22 | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `createStockCountLine` | POST `/stock-counts/{countId}/lines` | F22 stock_counts | M22/M22 | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `getStockCountLine` | GET `/stock-counts/{countId}/lines/{lineId}` | F22 stock_counts | M22/M22 | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `updateStockCountLine` | PATCH `/stock-counts/{countId}/lines/{lineId}` | F22 stock_counts | M22/M22 | [Ghi số kiểm kê](../../wr/stock_counts/editor.html) |
| `recountStock` | POST `/stock-counts/{countId}/recount` | F22 stock_counts | M22/M22 | [Đếm lại sau biến động](../../wr/stock_counts/recount.html) |
| `confirmStockCount` | POST `/stock-counts/{countId}/confirm` | F22 stock_counts | M22/M22 | [Xác nhận kiểm kê](../../wr/stock_counts/review.html) |
| `listSalesReturns` | GET `/sales-returns` | F23 sales_returns | M23/M23 | [Hàng trả lại](../../wr/sales_returns/index.html) |
| `createSalesReturn` | POST `/sales-returns` | F23 sales_returns | M23/M23 | [Ghi nhận hàng trả](../../wr/sales_returns/editor.html) |
| `getSalesReturn` | GET `/sales-returns/{documentId}` | F23 sales_returns | M23/M23 | [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) |
| `updateSalesReturnDraft` | PATCH `/sales-returns/{documentId}` | F23 sales_returns | M23/M23 | [Ghi nhận hàng trả](../../wr/sales_returns/editor.html) |
| `postSalesReturn` | POST `/sales-returns/{documentId}/post` | F23 sales_returns | M23/M23 | [Xác nhận nhận hàng](../../wr/sales_returns/review.html) |
| `correctSalesReturn` | POST `/sales-returns/{documentId}/corrections` | F23 sales_returns | M29/M29 | [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) |
| `cancelSalesReturn` | POST `/sales-returns/{documentId}/cancel` | F23 sales_returns | M23/M29 | [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) |
| `listCreditApplications` | GET `/credit-applications` | F25 credit_applications | M25/M25 | [Bù trừ dư có](../../wr/credit_applications/index.html) |
| `createCreditApplication` | POST `/credit-applications` | F25 credit_applications | M25/M25 | [Lập phiếu bù trừ](../../wr/credit_applications/editor.html) |
| `getCreditApplication` | GET `/credit-applications/{documentId}` | F25 credit_applications | M25/M25 | [Chi tiết bù trừ](../../wr/credit_applications/detail.html) |
| `updateCreditApplicationDraft` | PATCH `/credit-applications/{documentId}` | F25 credit_applications | M25/M25 | [Lập phiếu bù trừ](../../wr/credit_applications/editor.html) |
| `postCreditApplication` | POST `/credit-applications/{documentId}/post` | F25 credit_applications | M25/M25 | [Xác nhận bù trừ](../../wr/credit_applications/review.html) |
| `correctCreditApplication` | POST `/credit-applications/{documentId}/corrections` | F25 credit_applications | M29/M29 | [Chi tiết bù trừ](../../wr/credit_applications/detail.html) |
| `cancelCreditApplication` | POST `/credit-applications/{documentId}/cancel` | F25 credit_applications | M25/M29 | [Chi tiết bù trừ](../../wr/credit_applications/detail.html) |
| `listOnlinePayments` | GET `/online-payments` | F26 online_payments | M26/M26 | [Thanh toán trực tuyến](../../wr/online_payments/index.html) |
| `createOnlinePayment` | POST `/online-payments` | F26 online_payments | M26/M26 | [Tạo thanh toán](../../wr/online_payments/create.html) |
| `getOnlinePayment` | GET `/online-payments/{paymentId}` | F26 online_payments | M26/M26 | [Kết quả thanh toán](../../wr/online_payments/detail.html) |
| `listPaymentEvents` | GET `/online-payments/{paymentId}/events` | F26 online_payments | M26/M26 | [Sự kiện thanh toán](../../wr/online_payments/events.html) |
| `reconcileOnlinePayment` | POST `/online-payments/{paymentId}/reconcile` | F26 online_payments | M26/M26 | [Kết quả thanh toán](../../wr/online_payments/detail.html) |
| `receiveVerifiedPaymentWebhook` | POST `/payment-webhooks/{provider}` | Backend-only provider callback | M26/M26 | [backend-only](../online_payments/REQUIREMENTS.md) |
| `listRefunds` | GET `/refunds` | F27 refunds | M27/M27 | [Hoàn tiền](../../wr/refunds/index.html) |
| `createRefund` | POST `/refunds` | F27 refunds | M27/M27 | [Lập yêu cầu hoàn](../../wr/refunds/editor.html) |
| `getRefund` | GET `/refunds/{documentId}` | F27 refunds | M27/M27 | [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) |
| `updateRefundDraft` | PATCH `/refunds/{documentId}` | F27 refunds | M27/M27 | [Lập yêu cầu hoàn](../../wr/refunds/editor.html) |
| `submitRefund` | POST `/refunds/{documentId}/submit` | F27 refunds | M27/M27 | [Dành dư có để hoàn](../../wr/refunds/review.html) |
| `confirmManualRefundPaid` | POST `/refunds/{documentId}/confirm-paid` | F27 refunds | M27/M27 | [Xác nhận đã hoàn tiền](../../wr/refunds/confirm-paid.html) |
| `cancelUnpaidRefund` | POST `/refunds/{documentId}/cancel` | F27 refunds | M27/M27 | [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) |
| `listRefundAttempts` | GET `/refunds/{documentId}/attempts` | F27 refunds | M27/M27 | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `requestOnlineRefund` | POST `/refunds/{documentId}/attempts` | F27 refunds | M27/M27 | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `getRefundAttempt` | GET `/refund-attempts/{attemptId}` | F27 refunds | M27/M27 | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `reconcileRefundAttempt` | POST `/refund-attempts/{attemptId}/reconcile` | F27 refunds | M27/M27 | [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) |
| `listRefundReservations` | GET `/refunds/{documentId}/reservations` | F27 refunds | M27/M27 | [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) |
| `searchDocuments` | GET `/documents` | F28 document_history | M28/M28 | [Tra cứu chứng từ](../../wr/document_history/index.html) |
| `listDocumentRevisions` | GET `/documents/{documentId}/revisions` | F28 document_history | M13/M28 | [Lịch sử phiên bản](../../wr/document_history/revisions.html) |
| `getDocumentRevision` | GET `/documents/{documentId}/revisions/{revisionNo}` | F28 document_history | M13/M28 | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `listDocumentLines` | GET `/documents/{documentId}/revisions/{revisionNo}/lines` | F28 document_history | M13/M28 | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `createDocumentLine` | POST `/documents/{documentId}/revisions/{revisionNo}/lines` | F28 document_history | M13/M28 | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `getDocumentLine` | GET `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | F28 document_history | M13/M28 | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `replaceDocumentLine` | PUT `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | F28 document_history | M13/M28 | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `deleteDocumentLine` | DELETE `/documents/{documentId}/revisions/{revisionNo}/lines/{lineId}` | F28 document_history | M13/M28 | [Nội dung phiên bản cũ](../../wr/document_history/revision.html) |
| `printDocument` | GET `/documents/{documentId}/print` | F28 document_history | M28/M28 | [Bản in chứng từ](../../wr/document_history/print.html) |
| `getSalesReport` | GET `/reports/sales` | F30 reports | M30/M30 | [Báo cáo doanh số đại lý](../../wr/reports/sales.html) |
| `getDebtReport` | GET `/reports/debt` | F30 reports | M30/M30 | [Báo cáo công nợ](../../wr/reports/debt.html) |
| `getInventoryReport` | GET `/reports/inventory` | F30 reports | M30/M30 | [Báo cáo nhập xuất tồn](../../wr/reports/inventory.html) |
| `getProductSalesReport` | GET `/reports/product-sales` | F30 reports | M30/M30 | [Báo cáo bán theo mặt hàng](../../wr/reports/product-sales.html) |
| `getCashAndCreditReport` | GET `/reports/cash-and-credit` | F30 reports | M30/M30 | [Báo cáo thu chi và dư có](../../wr/reports/cash-credit.html) |
| `getDashboard` | GET `/dashboard` | F31 dashboard | M31/M31 | [Tổng quan](../../wr/dashboard/index.html) |
| `queryChatbot` | POST `/chatbot/queries` | F32 chatbot | M32/M32 | [Trợ lý tra cứu](../../wr/chatbot/index.html) |
