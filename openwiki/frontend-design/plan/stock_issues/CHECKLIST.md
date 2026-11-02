# F17 — stock_issues: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F17-SCR01: [Phiếu xuất hàng](../../wr/stock_issues/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F17-SCR02: [Lập phiếu xuất](../../wr/stock_issues/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F17-SCR03: [Chờ xuất kho](../../wr/stock_issues/pending.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F17-SCR04: [Thay nội dung chờ xuất](../../wr/stock_issues/replace-pending.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F17-SCR05: [Xác nhận xuất kho](../../wr/stock_issues/review.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F17-SCR06: [Chi tiết phiếu xuất](../../wr/stock_issues/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F17-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F17-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F17-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F17-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F17-FN05: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F17-FN06: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F17-OP01 `listStockIssues`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F17-OP02 `createStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F17-OP03 `getStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F17-OP04 `updateStockIssueDraft`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F17-OP05 `submitStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F17-OP06 `replacePendingStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F17-OP07 `postStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F17-OP08 `correctStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F17-OP09 `cancelStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Issue post/pending replacement are full-gated at M19; cancel at M29; no READY stock reservation.
