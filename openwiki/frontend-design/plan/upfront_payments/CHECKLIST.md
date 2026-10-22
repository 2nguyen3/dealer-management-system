# F19 — upfront_payments: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F19-SCR01: [Khoản trả ngay](../../wr/upfront_payments/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F19-SCR02: [Xác nhận tiền trả ngay](../../wr/upfront_payments/verify.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F19-SCR03: [Chi tiết xác nhận](../../wr/upfront_payments/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F19-SCR04: [Ghi nhận tiền riêng](../../wr/upfront_payments/receive-separately.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F19-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F19-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F19-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F19-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F19-OP01 `listUpfrontConfirmations`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F19-OP02 `verifyUpfrontPayment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F19-OP03 `getUpfrontConfirmation`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F19-OP04 `receiveUpfrontSeparately`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F19-OP05 `getStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F19-OP06 `replacePendingStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F19-OP07 `postStockIssue`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** VERIFIED is not a posted receipt; failed shipment must not make cash disappear.
