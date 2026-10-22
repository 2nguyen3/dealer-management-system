# F30 — reports: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F30-SCR01: [Trung tâm báo cáo](../../wr/reports/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F30-SCR02: [Báo cáo doanh số đại lý](../../wr/reports/sales.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F30-SCR03: [Báo cáo công nợ](../../wr/reports/debt.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F30-SCR04: [Báo cáo nhập xuất tồn](../../wr/reports/inventory.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F30-SCR05: [Báo cáo bán theo mặt hàng](../../wr/reports/product-sales.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F30-SCR06: [Báo cáo thu chi và dư có](../../wr/reports/cash-credit.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F30-SCR07: [Xuất báo cáo](../../wr/reports/export.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F30-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F30-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F30-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F30-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F30-FN05: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F30-FN06: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F30-FN07: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F30-OP01 `getSalesReport`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F30-OP02 `getDebtReport`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F30-OP03 `getInventoryReport`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F30-OP04 `getProductSalesReport`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F30-OP05 `getCashAndCreditReport`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** All five report operation IDs negotiate JSON/XLSX/PDF through Accept; export is full-filter, not current-page.
