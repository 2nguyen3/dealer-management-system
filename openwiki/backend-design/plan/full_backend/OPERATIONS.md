# Complete target operation inventory

Current2026-10-25:135target+2health mounted. M26six/M27twelve/M28nine IDs below are
published with native merchant/automatic-IPN/payment and signed refund request/query
evidence. External bank refund is still PENDING; terminal settlement/full release
remains open. M29–M32 retain19unpublished targets. See current owning VERIFICATION.

Current2026-10-24: ownership/first/full columns below are unchanged. Five M25 core
operations are mounted (108target+2health normal runtime). M26 six, M27 twelve and
M28 nine operations have full-branch code in the isolated composition; they remain
unpublished pending D07/prerequisite release gates. See AVAILABILITY and the owning
VERIFICATION files; the original M24 checkpoint wording below is historical.

Source: [OpenAPI](../../API/openapi.json). **154 unique operation IDs; 28 tags.**
Paths below are relative to `/api/v1`. Every row has one implementation owner.
Exact path parameters, request/response schemas, errors, permissions and headers
remain in the source contract; the validator checks method/path/ID coverage.

`First` identifies the initial implementation slice; `Full` is the earliest
whole-operation gate. Authentication, all administration/audit and master data
are locally complete (M01/M03–M12); M14's inventory statement and M15's five
receipt read/create/header/post operations are also published. M17–M20 add22 full
issue/manual-receipt/upfront/receivable operations (80target at that checkpoint).
M21–M24 add23complete adjustment/count/return/credit reads and writers:103target total.
M13 internal foundations are verified; remaining M25–M32/deferred rows are **planned**, including
those whose first slice supplies only a state branch. Cross-workflow
regression remains required after later consumers appear. Actual publication/
evidence is in [AVAILABILITY](AVAILABILITY.md); this inventory preserves ownership.

Publication additionally requires support for the dependency kinds already stored
in the deployment database (D17) and the necessary consumer operations. Use the
[release handoff map](EXECUTION.md#3-early-implementation-versus-a-usable-release);
First/Full are implementation lower bounds, not automatic deployment dates.

## Authentication

| Operation ID | Method | Path | Owner | First | Full |
| --- | --- | --- | --- | --- | --- |
| login | POST | /auth/login | authentication | M01 | M01 |
| refreshTokens | POST | /auth/refresh | authentication | M01 | M01 |
| logout | POST | /auth/logout | authentication | M01 | M01 |
| getCurrentUser | GET | /auth/me | authentication | M01 | M01 |
| changePassword | PUT | /auth/password | authentication | M01 | M01 |
| requestPasswordReset | POST | /auth/password-reset-requests | authentication | M01 | M01 |
| resetPasswordWithToken | POST | /auth/password-resets | authentication | M01 | M01 |

## Access administration

| Operation ID | Method | Path | Owner | First | Full |
| --- | --- | --- | --- | --- | --- |
| listUserGroups | GET | /user-groups | user_groups | M03 | M03 |
| createUserGroup | POST | /user-groups | user_groups | M03 | M03 |
| getUserGroup | GET | /user-groups/{groupId} | user_groups | M03 | M03 |
| updateUserGroup | PATCH | /user-groups/{groupId} | user_groups | M03 | M03 |
| deleteUserGroup | DELETE | /user-groups/{groupId} | user_groups | M03 | M03 |
| listUsers | GET | /users | users | M04 | M04 |
| createUser | POST | /users | users | M04 | M04 |
| getUser | GET | /users/{userId} | users | M04 | M04 |
| updateUser | PATCH | /users/{userId} | users | M04 | M04 |
| resetUserPassword | POST | /users/{userId}/password-reset | users | M04 | M04 |
| listFunctions | GET | /functions | permissions | M05 | M05 |
| getFunction | GET | /functions/{functionId} | permissions | M05 | M05 |
| listGroupPermissions | GET | /user-groups/{groupId}/permissions | permissions | M05 | M05 |
| getGroupPermission | GET | /user-groups/{groupId}/permissions/{functionId} | permissions | M05 | M05 |
| setGroupPermission | PUT | /user-groups/{groupId}/permissions/{functionId} | permissions | M05 | M05 |
| listAuditLogs | GET | /audit-logs | audit_logs | M06 | M06 |
| getAuditLog | GET | /audit-logs/{auditId} | audit_logs | M06 | M06 |

## Master data and agencies

| Operation ID | Method | Path | Owner | First | Full |
| --- | --- | --- | --- | --- | --- |
| listDistricts | GET | /districts | districts | M07 | M07 |
| createDistrict | POST | /districts | districts | M07 | M07 |
| getDistrict | GET | /districts/{districtId} | districts | M07 | M07 |
| updateDistrict | PATCH | /districts/{districtId} | districts | M07 | M07 |
| deleteDistrict | DELETE | /districts/{districtId} | districts | M07 | M07 |
| listAgencyTypes | GET | /agency-types | agency_types | M08 | M08 |
| createAgencyType | POST | /agency-types | agency_types | M08 | M08 |
| getAgencyType | GET | /agency-types/{typeId} | agency_types | M08 | M08 |
| updateAgencyType | PATCH | /agency-types/{typeId} | agency_types | M08 | M08 |
| deleteAgencyType | DELETE | /agency-types/{typeId} | agency_types | M08 | M08 |
| listUnits | GET | /units | units | M09 | M09 |
| createUnit | POST | /units | units | M09 | M09 |
| getUnit | GET | /units/{unitId} | units | M09 | M09 |
| updateUnit | PATCH | /units/{unitId} | units | M09 | M09 |
| deleteUnit | DELETE | /units/{unitId} | units | M09 | M09 |
| getBusinessRules | GET | /business-rules | business_rules | M10 | M10 |
| updateBusinessRules | PATCH | /business-rules | business_rules | M10 | M10 |
| listProducts | GET | /products | products | M11 | M11 |
| createProduct | POST | /products | products | M11 | M11 |
| getProduct | GET | /products/{productId} | products | M11 | M11 |
| updateProduct | PATCH | /products/{productId} | products | M11 | M11 |
| deleteProduct | DELETE | /products/{productId} | products | M11 | M11 |
| listAgencies | GET | /agencies | agencies | M12 | M12 |
| createAgency | POST | /agencies | agencies | M12 | M12 |
| getAgency | GET | /agencies/{agencyId} | agencies | M12 | M12 |
| updateAgency | PATCH | /agencies/{agencyId} | agencies | M12 | M12 |
| deleteAgency | DELETE | /agencies/{agencyId} | agencies | M12 | M12 |
| terminateAgency | POST | /agencies/{agencyId}/terminate | agencies | M12 | M12 |

## Goods, receipts and upfront payments

| Operation ID | Method | Path | Owner | First | Full |
| --- | --- | --- | --- | --- | --- |
| listProductInventoryEntries | GET | /products/{productId}/inventory-entries | inventory | M14 | M14 |
| listStockReceipts | GET | /stock-receipts | stock_receipts | M15 | M15 |
| createStockReceipt | POST | /stock-receipts | stock_receipts | M15 | M15 |
| getStockReceipt | GET | /stock-receipts/{documentId} | stock_receipts | M15 | M15 |
| updateStockReceiptDraft | PATCH | /stock-receipts/{documentId} | stock_receipts | M15 | M15 |
| postStockReceipt | POST | /stock-receipts/{documentId}/post | stock_receipts | M15 | M15 |
| correctStockReceipt | POST | /stock-receipts/{documentId}/corrections | stock_receipts | M29 | M29 |
| cancelStockReceipt | POST | /stock-receipts/{documentId}/cancel | stock_receipts | M15 | M29 |
| listStockIssues | GET | /stock-issues | stock_issues | M17 | M17 |
| createStockIssue | POST | /stock-issues | stock_issues | M17 | M17 |
| getStockIssue | GET | /stock-issues/{documentId} | stock_issues | M17 | M17 |
| updateStockIssueDraft | PATCH | /stock-issues/{documentId} | stock_issues | M17 | M17 |
| submitStockIssue | POST | /stock-issues/{documentId}/submit | stock_issues | M17 | M17 |
| replacePendingStockIssue | POST | /stock-issues/{documentId}/revisions | stock_issues | M17 | M19 |
| postStockIssue | POST | /stock-issues/{documentId}/post | stock_issues | M17 | M19 |
| correctStockIssue | POST | /stock-issues/{documentId}/corrections | stock_issues | M29 | M29 |
| cancelStockIssue | POST | /stock-issues/{documentId}/cancel | stock_issues | M17 | M29 |
| listPaymentReceipts | GET | /payment-receipts | payment_receipts | M18 | M18 |
| createPaymentReceipt | POST | /payment-receipts | payment_receipts | M18 | M18 |
| getPaymentReceipt | GET | /payment-receipts/{documentId} | payment_receipts | M18 | M18 |
| updatePaymentReceiptDraft | PATCH | /payment-receipts/{documentId} | payment_receipts | M18 | M18 |
| postPaymentReceipt | POST | /payment-receipts/{documentId}/post | payment_receipts | M18 | M18 |
| correctPaymentReceipt | POST | /payment-receipts/{documentId}/corrections | payment_receipts | M29 | M29 |
| cancelPaymentReceipt | POST | /payment-receipts/{documentId}/cancel | payment_receipts | M18 | M29 |
| listUpfrontConfirmations | GET | /upfront-confirmations | upfront_payments | M19 | M19 |
| verifyUpfrontPayment | POST | /upfront-confirmations | upfront_payments | M19 | M19 |
| getUpfrontConfirmation | GET | /upfront-confirmations/{confirmationId} | upfront_payments | M19 | M19 |
| receiveUpfrontSeparately | POST | /upfront-confirmations/{confirmationId}/receive-separately | upfront_payments | M19 | M19 |

## Statements and credit reads

| Operation ID | Method | Path | Owner | First | Full |
| --- | --- | --- | --- | --- | --- |
| listReceivables | GET | /receivables | receivables | M20 | M20 |
| getAgencyBalance | GET | /agencies/{agencyId}/balance | receivables | M20 | M20 |
| listAgencyInvoiceBalances | GET | /agencies/{agencyId}/invoice-balances | receivables | M20 | M20 |
| getInvoiceBalance | GET | /stock-issues/{documentId}/balance | receivables | M20 | M20 |
| listAgencyReceivableEntries | GET | /agencies/{agencyId}/receivable-entries | receivables | M20 | M20 |
| listDocumentAllocations | GET | /documents/{documentId}/allocations | receivables | M20 | M20 |
| listAgencyCreditLots | GET | /agencies/{agencyId}/credit-lots | agency_credit | M24 | M24 |
| getCreditLot | GET | /credit-lots/{lotId} | agency_credit | M24 | M24 |
| listAgencyCreditEntries | GET | /agencies/{agencyId}/credit-entries | agency_credit | M24 | M24 |

`getAgencyBalance` is shared by Receivables and Agency Credit; M24 reuses M20's
route/query rather than registering another handler. M20 readers already include
return/credit/refund ledger kinds from the schema and seeded/isolated fixtures;
later writers add integration regression, not a second balance API.

## Counts, adjustments, returns and applications

| Operation ID | Method | Path | Owner | First | Full |
| --- | --- | --- | --- | --- | --- |
| listStockAdjustments | GET | /stock-adjustments | stock_adjustments | M21 | M21 |
| createStockAdjustment | POST | /stock-adjustments | stock_adjustments | M21 | M21 |
| getStockAdjustment | GET | /stock-adjustments/{documentId} | stock_adjustments | M21 | M21 |
| updateStockAdjustmentDraft | PATCH | /stock-adjustments/{documentId} | stock_adjustments | M21 | M21 |
| postStockAdjustment | POST | /stock-adjustments/{documentId}/post | stock_adjustments | M21 | M21 |
| correctStockAdjustment | POST | /stock-adjustments/{documentId}/corrections | stock_adjustments | M29 | M29 |
| cancelStockAdjustment | POST | /stock-adjustments/{documentId}/cancel | stock_adjustments | M21 | M29 |
| listStockCounts | GET | /stock-counts | stock_counts | M22 | M22 |
| createStockCount | POST | /stock-counts | stock_counts | M22 | M22 |
| getStockCount | GET | /stock-counts/{countId} | stock_counts | M22 | M22 |
| updateStockCountDraft | PATCH | /stock-counts/{countId} | stock_counts | M22 | M22 |
| listStockCountLines | GET | /stock-counts/{countId}/lines | stock_counts | M22 | M22 |
| createStockCountLine | POST | /stock-counts/{countId}/lines | stock_counts | M22 | M22 |
| getStockCountLine | GET | /stock-counts/{countId}/lines/{lineId} | stock_counts | M22 | M22 |
| updateStockCountLine | PATCH | /stock-counts/{countId}/lines/{lineId} | stock_counts | M22 | M22 |
| recountStock | POST | /stock-counts/{countId}/recount | stock_counts | M22 | M22 |
| confirmStockCount | POST | /stock-counts/{countId}/confirm | stock_counts | M22 | M22 |
| listSalesReturns | GET | /sales-returns | sales_returns | M23 | M23 |
| createSalesReturn | POST | /sales-returns | sales_returns | M23 | M23 |
| getSalesReturn | GET | /sales-returns/{documentId} | sales_returns | M23 | M23 |
| updateSalesReturnDraft | PATCH | /sales-returns/{documentId} | sales_returns | M23 | M23 |
| postSalesReturn | POST | /sales-returns/{documentId}/post | sales_returns | M23 | M23 |
| correctSalesReturn | POST | /sales-returns/{documentId}/corrections | sales_returns | M29 | M29 |
| cancelSalesReturn | POST | /sales-returns/{documentId}/cancel | sales_returns | M23 | M29 |
| listCreditApplications | GET | /credit-applications | credit_applications | M25 | M25 |
| createCreditApplication | POST | /credit-applications | credit_applications | M25 | M25 |
| getCreditApplication | GET | /credit-applications/{documentId} | credit_applications | M25 | M25 |
| updateCreditApplicationDraft | PATCH | /credit-applications/{documentId} | credit_applications | M25 | M25 |
| postCreditApplication | POST | /credit-applications/{documentId}/post | credit_applications | M25 | M25 |
| correctCreditApplication | POST | /credit-applications/{documentId}/corrections | credit_applications | M29 | M29 |
| cancelCreditApplication | POST | /credit-applications/{documentId}/cancel | credit_applications | M25 | M29 |

## Online payments and refunds

| Operation ID | Method | Path | Owner | First | Full |
| --- | --- | --- | --- | --- | --- |
| listOnlinePayments | GET | /online-payments | online_payments | M26 | M26 |
| createOnlinePayment | POST | /online-payments | online_payments | M26 | M26 |
| getOnlinePayment | GET | /online-payments/{paymentId} | online_payments | M26 | M26 |
| listPaymentEvents | GET | /online-payments/{paymentId}/events | online_payments | M26 | M26 |
| reconcileOnlinePayment | POST | /online-payments/{paymentId}/reconcile | online_payments | M26 | M26 |
| receiveVerifiedPaymentWebhook | POST | /payment-webhooks/{provider} | online_payments | M26 | M26 |
| listRefunds | GET | /refunds | refunds | M27 | M27 |
| createRefund | POST | /refunds | refunds | M27 | M27 |
| getRefund | GET | /refunds/{documentId} | refunds | M27 | M27 |
| updateRefundDraft | PATCH | /refunds/{documentId} | refunds | M27 | M27 |
| submitRefund | POST | /refunds/{documentId}/submit | refunds | M27 | M27 |
| confirmManualRefundPaid | POST | /refunds/{documentId}/confirm-paid | refunds | M27 | M27 |
| cancelUnpaidRefund | POST | /refunds/{documentId}/cancel | refunds | M27 | M27 |
| listRefundAttempts | GET | /refunds/{documentId}/attempts | refunds | M27 | M27 |
| requestOnlineRefund | POST | /refunds/{documentId}/attempts | refunds | M27 | M27 |
| getRefundAttempt | GET | /refund-attempts/{attemptId} | refunds | M27 | M27 |
| reconcileRefundAttempt | POST | /refund-attempts/{attemptId}/reconcile | refunds | M27 | M27 |
| listRefundReservations | GET | /refunds/{documentId}/reservations | refunds | M27 | M27 |

M27 has internal manual and online subphases; whole-operation/module closure waits
for all supported payment methods. A refund stays DRAFT while reserved/in flight;
attempt/reservation state expresses waiting, not an invented READY refund revision.

## History and read products

| Operation ID | Method | Path | Owner | First | Full |
| --- | --- | --- | --- | --- | --- |
| searchDocuments | GET | /documents | document_history | M28 | M28 |
| listDocumentRevisions | GET | /documents/{documentId}/revisions | document_history | M13 | M28 |
| getDocumentRevision | GET | /documents/{documentId}/revisions/{revisionNo} | document_history | M13 | M28 |
| listDocumentLines | GET | /documents/{documentId}/revisions/{revisionNo}/lines | document_history | M13 | M28 |
| createDocumentLine | POST | /documents/{documentId}/revisions/{revisionNo}/lines | document_history | M13 | M28 |
| getDocumentLine | GET | /documents/{documentId}/revisions/{revisionNo}/lines/{lineId} | document_history | M13 | M28 |
| replaceDocumentLine | PUT | /documents/{documentId}/revisions/{revisionNo}/lines/{lineId} | document_history | M13 | M28 |
| deleteDocumentLine | DELETE | /documents/{documentId}/revisions/{revisionNo}/lines/{lineId} | document_history | M13 | M28 |
| printDocument | GET | /documents/{documentId}/print | document_history | M28 | M28 |
| getSalesReport | GET | /reports/sales | reports | M30 | M30 |
| getDebtReport | GET | /reports/debt | reports | M30 | M30 |
| getInventoryReport | GET | /reports/inventory | reports | M30 | M30 |
| getProductSalesReport | GET | /reports/product-sales | reports | M30 | M30 |
| getCashAndCreditReport | GET | /reports/cash-and-credit | reports | M30 | M30 |
| getDashboard | GET | /dashboard | dashboard | M31 | M31 |
| queryChatbot | POST | /chatbot/queries | chatbot | M32 | M32 |

## Internal ownership and deferred integration

- M02 supplies shared transport/transaction infrastructure; no new business endpoint.
- M13 supplies document mappings, snapshots, line/revision primitives and read
  projections. Document History owns their public operation IDs; goods modules
  supply kind validation at M15/M17/M21/M23. M28 closes all dispatch/history/print.
- M16 owns charges, FIFO, receipt/credit/provenance/reservation primitives and
  chronology-aware replay for already supported kinds; no public allocation CRUD.
- M19 completes the money-dependent stock-issue branches, including pending
  replacement after separation. M29 completes posted cancellation/correction.
- M29 orchestrates replay while each original resource retains its endpoint tag,
  router and permission policy. Six correction and six cancellation operations
  are full-gated at M29; none is a new generic correction HTTP resource.
- Two health operations are runtime infrastructure outside the target's 154.

Validation must fail on omitted/duplicate IDs, wrong method/path, unknown owner,
unresolved local links or a full gate preceding first delivery. Update this file
when the target changes; do not hand-maintain copied schema definitions here.
