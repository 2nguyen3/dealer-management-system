# F21 — stock_adjustments: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F21-SCR01: [Điều chỉnh tồn](../../wr/stock_adjustments/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F21-SCR02: [Lập phiếu điều chỉnh](../../wr/stock_adjustments/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F21-SCR03: [Xác nhận điều chỉnh](../../wr/stock_adjustments/review.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F21-SCR04: [Chi tiết điều chỉnh](../../wr/stock_adjustments/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F21-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F21-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F21-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F21-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F21-OP01 `listStockAdjustments`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F21-OP02 `createStockAdjustment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F21-OP03 `getStockAdjustment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F21-OP04 `updateStockAdjustmentDraft`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F21-OP05 `postStockAdjustment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F21-OP06 `correctStockAdjustment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F21-OP07 `cancelStockAdjustment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Adjustments do not create sales or change purchase-price source.
