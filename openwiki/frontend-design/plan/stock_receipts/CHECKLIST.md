# F16 — stock_receipts: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F16-SCR01: [Phiếu nhập hàng](../../wr/stock_receipts/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F16-SCR02: [Lập phiếu nhập](../../wr/stock_receipts/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F16-SCR03: [Xác nhận nhập kho](../../wr/stock_receipts/review.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F16-SCR04: [Chi tiết phiếu nhập](../../wr/stock_receipts/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F16-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F16-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F16-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F16-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F16-OP01 `listStockReceipts`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F16-OP02 `createStockReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F16-OP03 `getStockReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F16-OP04 `updateStockReceiptDraft`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F16-OP05 `postStockReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F16-OP06 `correctStockReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F16-OP07 `cancelStockReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Receipt create-with-lines is distinct from later published shared line editing and full cancellation.
