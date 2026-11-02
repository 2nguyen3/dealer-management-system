# F18 — payment_receipts: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F18-SCR01: [Phiếu thu](../../wr/payment_receipts/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F18-SCR02: [Lập phiếu thu công nợ](../../wr/payment_receipts/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F18-SCR03: [Xác nhận tiền đã thu](../../wr/payment_receipts/review.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F18-SCR04: [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F18-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F18-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F18-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F18-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F18-OP01 `listPaymentReceipts`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F18-OP02 `createPaymentReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F18-OP03 `getPaymentReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F18-OP04 `updatePaymentReceiptDraft`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F18-OP05 `postPaymentReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F18-OP06 `correctPaymentReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F18-OP07 `cancelPaymentReceipt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Never offer manual selection or mutation of invoice allocations.
