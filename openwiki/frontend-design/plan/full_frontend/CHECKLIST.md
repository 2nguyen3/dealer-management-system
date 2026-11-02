# Full frontend — Checklist

**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.

## Planning and paired HTML inventory

- [x] F01 paired [child plan](../frontend_foundations/PLAN.md) and [wireframe index](../../wr/frontend_foundations/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F02 paired [child plan](../authentication/PLAN.md) and [wireframe index](../../wr/authentication/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F03 paired [child plan](../application_shell/PLAN.md) and [wireframe index](../../wr/application_shell/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F04 paired [child plan](../user_groups/PLAN.md) and [wireframe index](../../wr/user_groups/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F05 paired [child plan](../users/PLAN.md) and [wireframe index](../../wr/users/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F06 paired [child plan](../permissions/PLAN.md) and [wireframe index](../../wr/permissions/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F07 paired [child plan](../audit_logs/PLAN.md) and [wireframe index](../../wr/audit_logs/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F08 paired [child plan](../districts/PLAN.md) and [wireframe index](../../wr/districts/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F09 paired [child plan](../agency_types/PLAN.md) and [wireframe index](../../wr/agency_types/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F10 paired [child plan](../units/PLAN.md) and [wireframe index](../../wr/units/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F11 paired [child plan](../business_rules/PLAN.md) and [wireframe index](../../wr/business_rules/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F12 paired [child plan](../products/PLAN.md) and [wireframe index](../../wr/products/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F13 paired [child plan](../agencies/PLAN.md) and [wireframe index](../../wr/agencies/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F14 paired [child plan](../document_workbench/PLAN.md) and [wireframe index](../../wr/document_workbench/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F15 paired [child plan](../inventory/PLAN.md) and [wireframe index](../../wr/inventory/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F16 paired [child plan](../stock_receipts/PLAN.md) and [wireframe index](../../wr/stock_receipts/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F17 paired [child plan](../stock_issues/PLAN.md) and [wireframe index](../../wr/stock_issues/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F18 paired [child plan](../payment_receipts/PLAN.md) and [wireframe index](../../wr/payment_receipts/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F19 paired [child plan](../upfront_payments/PLAN.md) and [wireframe index](../../wr/upfront_payments/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F20 paired [child plan](../receivables/PLAN.md) and [wireframe index](../../wr/receivables/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F21 paired [child plan](../stock_adjustments/PLAN.md) and [wireframe index](../../wr/stock_adjustments/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F22 paired [child plan](../stock_counts/PLAN.md) and [wireframe index](../../wr/stock_counts/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F23 paired [child plan](../sales_returns/PLAN.md) and [wireframe index](../../wr/sales_returns/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F24 paired [child plan](../agency_credit/PLAN.md) and [wireframe index](../../wr/agency_credit/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F25 paired [child plan](../credit_applications/PLAN.md) and [wireframe index](../../wr/credit_applications/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F26 paired [child plan](../online_payments/PLAN.md) and [wireframe index](../../wr/online_payments/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F27 paired [child plan](../refunds/PLAN.md) and [wireframe index](../../wr/refunds/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F28 paired [child plan](../document_history/PLAN.md) and [wireframe index](../../wr/document_history/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F29 paired [child plan](../document_corrections/PLAN.md) and [wireframe index](../../wr/document_corrections/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F30 paired [child plan](../reports/PLAN.md) and [wireframe index](../../wr/reports/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F31 paired [child plan](../dashboard/PLAN.md) and [wireframe index](../../wr/dashboard/index.html) prepared; interactive/browser review and application gates remain open.
- [x] F32 paired [child plan](../chatbot/PLAN.md) and [wireframe index](../../wr/chatbot/index.html) prepared; interactive/browser review and application gates remain open.
- [ ] Source/operation/HTML-link consistency validator and manual desktop/mobile/keyboard prototype review recorded in VERIFICATION.

## Runtime and release (open)

- [ ] F01 dependencies/test harness installed with npm lockfile and actual behavior cases.
- [ ] F02 real auth/browser rotation, reset and permission-refresh checks pass.
- [ ] Every business action's backend full publication and D17 persisted-kind/deployment gate verified independently of mocked pages.
- [ ] All F03–F32 child actual-symbol success/failure/boundary, accessibility, branch coverage, mocked and isolated live browser cases pass.
- [ ] M28 line/print and M29 correction/cancellation deferred cases integrated into owning goods/money modules (backend R5).
- [ ] D07/D09/D10/D16 and lookup/retry contract choices resolved in single source before affected final integration.
- [ ] Five reports and full exports, dashboard and chatbot production-read gates plus cross-reader invalidation pass (backend R6).
- [ ] General Plan/Checklist, child verification, root/UI guidance and production build evidence aligned before release.

No check in the runtime section is closed by generating Markdown or HTML.
