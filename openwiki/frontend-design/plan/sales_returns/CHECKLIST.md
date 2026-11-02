# F23 — sales_returns: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F23-SCR01: [Hàng trả lại](../../wr/sales_returns/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F23-SCR02: [Chọn phiếu xuất gốc](../../wr/sales_returns/source.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F23-SCR03: [Ghi nhận hàng trả](../../wr/sales_returns/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F23-SCR04: [Xác nhận nhận hàng](../../wr/sales_returns/review.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F23-SCR05: [Chi tiết phiếu trả](../../wr/sales_returns/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F23-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F23-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F23-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F23-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F23-FN05: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F23-OP01 `listSalesReturns`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F23-OP02 `createSalesReturn`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F23-OP03 `getSalesReturn`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F23-OP04 `updateSalesReturnDraft`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F23-OP05 `postSalesReturn`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F23-OP06 `correctSalesReturn`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F23-OP07 `cancelSalesReturn`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** A valid zero-VND line still changes returned quantity and inventory.
