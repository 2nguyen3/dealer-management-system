# F29 — document_corrections: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F29-SCR01: [Sửa sai và hủy chứng từ](../../wr/document_corrections/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F29-SCR02: [Sửa phiếu nhập](../../wr/document_corrections/stock-receipt.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F29-SCR03: [Sửa phiếu xuất](../../wr/document_corrections/stock-issue.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F29-SCR04: [Sửa phiếu thu](../../wr/document_corrections/payment-receipt.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F29-SCR05: [Sửa điều chỉnh kho](../../wr/document_corrections/stock-adjustment.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F29-SCR06: [Sửa phiếu trả](../../wr/document_corrections/sales-return.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F29-SCR07: [Sửa phiếu bù trừ](../../wr/document_corrections/credit-application.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F29-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F29-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F29-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F29-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F29-FN05: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F29-FN06: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F29-FN07: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F29-OP01 `correctStockReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP02 `cancelStockReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP03 `correctStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP04 `cancelStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP05 `correctPaymentReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP06 `cancelPaymentReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP07 `correctStockAdjustment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP08 `cancelStockAdjustment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP09 `correctSalesReturn`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP10 `cancelSalesReturn`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP11 `correctCreditApplication`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F29-OP12 `cancelCreditApplication`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Every correction/cancel retains its owning API route and needs documents.correct plus owning post rights where specified.
