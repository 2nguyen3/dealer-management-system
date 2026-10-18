# Full frontend — Modules

**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.

## Paired module work packages

For each row, finish the six-file child and its linked multi-page wireframes as one planning deliverable. Independently author different module pairs after shared CSS/fixtures; implementation still follows the frontend dependency graph. Each child registers actual symbols during code implementation; plans do not mark frontend runtime behavior as tested.

| Slice | Child plan | Frontend prerequisites | Backend gate | Wireframes | Cross-slice obligation |
| --- | --- | --- | --- | --- | --- |
| F01 | [`frontend_foundations`](../frontend_foundations/PLAN.md) | Existing UI starter | M02 (business transport) | [4 screens](../../wr/frontend_foundations/index.html) | Source-derived JSON validation and exact amount, ID and business-date representations. |
| F02 | [`authentication`](../authentication/PLAN.md) | F01 | M01 | [5 screens](../../wr/authentication/index.html) | Single-use refresh: one winner; wrong-current-password 401 must never trigger a refresh loop. |
| F03 | [`application_shell`](../application_shell/PLAN.md) | F02 | M01/M02 | [4 screens](../../wr/application_shell/index.html) | Read-only access remains possible without manage grants; no MANAGEMENT bypass. |
| F04 | [`user_groups`](../user_groups/PLAN.md) | F03 | M03 | [3 screens](../../wr/user_groups/index.html) | Delete requires groups.manage AND permissions.manage; grant cleanup is backend-atomic. |
| F05 | [`users`](../users/PLAN.md) | F04 | M04 | [4 screens](../../wr/users/index.html) | Group/status/admin-password changes invalidate live sessions; email uniqueness is case-insensitive. |
| F06 | [`permissions`](../permissions/PLAN.md) | F05 | M05 | [4 screens](../../wr/permissions/index.html) | Never send both If-Match and If-None-Match; isAllowed=false revokes without deleting the record. |
| F07 | [`audit_logs`](../audit_logs/PLAN.md) | F06 | M06 | [2 screens](../../wr/audit_logs/index.html) | No edit/delete or raw password, token or provider payload controls. |
| F08 | [`districts`](../districts/PLAN.md) | F03 | M07 | [3 screens](../../wr/districts/index.html) | Capacity is global and server-enforced under concurrent dealer admissions. |
| F09 | [`agency_types`](../agency_types/PLAN.md) | F03 | M08 | [4 screens](../../wr/agency_types/index.html) | Both active and terminated agencies can block lowering the limit. |
| F10 | [`units`](../units/PLAN.md) | F03 | M09 | [3 screens](../../wr/units/index.html) | Fractional policy is not a conversion system and cannot change after recorded use. |
| F11 | [`business_rules`](../business_rules/PLAN.md) | F08, F09 | M10 | [3 screens](../../wr/business_rules/index.html) | D16 must settle derived quote bounds before rate/price consumers publish. |
| F12 | [`products`](../products/PLAN.md) | F10, F11 | M11 | [3 screens](../../wr/products/index.html) | D02 eligible deletion and D16 derived selling-price response policy must be resolved. |
| F13 | [`agencies`](../agencies/PLAN.md) | F08, F09, F11 | M12 | [4 screens](../../wr/agencies/index.html) | No reactivation endpoint; eligible unused deletion depends on the shared D02 repair. |
| F14 | [`document_workbench`](../document_workbench/PLAN.md) | F12, F13 | M13/M28 | [4 screens](../../wr/document_workbench/index.html) | Shared line/revision operations are full-gated at M28 even when an earlier kind can create lines. |
| F15 | [`inventory`](../inventory/PLAN.md) | F14 | M14 | [3 screens](../../wr/inventory/index.html) | Never aggregate unlike product units into a single quantity. |
| F16 | [`stock_receipts`](../stock_receipts/PLAN.md) | F15 | M15/M28/M29 | [4 screens](../../wr/stock_receipts/index.html) | Receipt create-with-lines is distinct from later published shared line editing and full cancellation. |
| F17 | [`stock_issues`](../stock_issues/PLAN.md) | F16 | M17/M19/M28/M29 | [6 screens](../../wr/stock_issues/index.html) | Issue post/pending replacement are full-gated at M19; cancel at M29; no READY stock reservation. |
| F18 | [`payment_receipts`](../payment_receipts/PLAN.md) | F17 | M18/M28/M29 | [4 screens](../../wr/payment_receipts/index.html) | Never offer manual selection or mutation of invoice allocations. |
| F19 | [`upfront_payments`](../upfront_payments/PLAN.md) | F18 | M19 | [4 screens](../../wr/upfront_payments/index.html) | VERIFIED is not a posted receipt; failed shipment must not make cash disappear. |
| F20 | [`receivables`](../receivables/PLAN.md) | F19 | M20 | [5 screens](../../wr/receivables/index.html) | The agency balance resource belongs to F20 and is reused—not duplicated—by F24. |
| F21 | [`stock_adjustments`](../stock_adjustments/PLAN.md) | F16 | M21/M28/M29 | [4 screens](../../wr/stock_adjustments/index.html) | Adjustments do not create sales or change purchase-price source. |
| F22 | [`stock_counts`](../stock_counts/PLAN.md) | F21 | M22 | [5 screens](../../wr/stock_counts/index.html) | An intervening movement is stale even if the quantity returns to its original value. |
| F23 | [`sales_returns`](../sales_returns/PLAN.md) | F20 | M23/M28/M29 | [5 screens](../../wr/sales_returns/index.html) | A valid zero-VND line still changes returned quantity and inventory. |
| F24 | [`agency_credit`](../agency_credit/PLAN.md) | F23 | M24 | [4 screens](../../wr/agency_credit/index.html) | Available credit excludes live reservations; later F27 refund states require regression. |
| F25 | [`credit_applications`](../credit_applications/PLAN.md) | F24 | M25/M28/M29 | [4 screens](../../wr/credit_applications/index.html) | Credit application is not new cash; posted correction/cancel full-gated at M29. |
| F26 | [`online_payments`](../online_payments/PLAN.md) | F24 | M26 | [6 screens](../../wr/online_payments/index.html) | The provider webhook is server-to-server, not a frontend action; no return URL proves SUCCESS. |
| F27 | [`refunds`](../refunds/PLAN.md) | F25, F26 | M27 | [7 screens](../../wr/refunds/index.html) | UNKNOWN keeps credit reserved; the source requestOnlineRefund operation has no reason body. |
| F28 | [`document_history`](../document_history/PLAN.md) | F14, F22, F27 | M28 | [5 screens](../../wr/document_history/index.html) | Bearer-protected print requires fetch/blob or authenticated HTML handling, not a bare hyperlink. |
| F29 | [`document_corrections`](../document_corrections/PLAN.md) | F28 | M29 | [7 screens](../../wr/document_corrections/index.html) | Every correction/cancel retains its owning API route and needs documents.correct plus owning post rights where specified. |
| F30 | [`reports`](../reports/PLAN.md) | F29 | M30 | [7 screens](../../wr/reports/index.html) | All five report operation IDs negotiate JSON/XLSX/PDF through Accept; export is full-filter, not current-page. |
| F31 | [`dashboard`](../dashboard/PLAN.md) | F30 | M31/D09 | [4 screens](../../wr/dashboard/index.html) | D09 admission/section-permission mismatch requires a source decision before final integration. |
| F32 | [`chatbot`](../chatbot/PLAN.md) | F31 | M32/D10 | [4 screens](../../wr/chatbot/index.html) | D10 candidate paging is not yet safe for chatbot-only grants; no invented cursor in the current contract. |

Full operational user-facing handoff for document line/cancel/history/corrections depends on backend R5; later read products depend on R6. F20 owns getAgencyBalance; F24 consumes it. F29 supplies orchestration UI embedded within each document kind; no generic correction API exists.
