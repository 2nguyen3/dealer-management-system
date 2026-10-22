# F22 — stock_counts: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F22-SCR01: [Kiểm kê kho](../../wr/stock_counts/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F22-SCR02: [Ghi số kiểm kê](../../wr/stock_counts/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F22-SCR03: [Xác nhận kiểm kê](../../wr/stock_counts/review.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F22-SCR04: [Đếm lại sau biến động](../../wr/stock_counts/recount.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F22-SCR05: [Biên bản kiểm kê](../../wr/stock_counts/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F22-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F22-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F22-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F22-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F22-FN05: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F22-OP01 `listStockCounts`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F22-OP02 `createStockCount`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F22-OP03 `getStockCount`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F22-OP04 `updateStockCountDraft`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F22-OP05 `listStockCountLines`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F22-OP06 `createStockCountLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F22-OP07 `getStockCountLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F22-OP08 `updateStockCountLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F22-OP09 `recountStock`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F22-OP10 `confirmStockCount`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** An intervening movement is stale even if the quantity returns to its original value.
