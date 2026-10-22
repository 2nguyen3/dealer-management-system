# F27 — refunds: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F27-SCR01: [Hoàn tiền](../../wr/refunds/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F27-SCR02: [Lập yêu cầu hoàn](../../wr/refunds/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F27-SCR03: [Dành dư có để hoàn](../../wr/refunds/review.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F27-SCR04: [Chi tiết phiếu hoàn](../../wr/refunds/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F27-SCR05: [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F27-SCR06: [Xác nhận đã hoàn tiền](../../wr/refunds/confirm-paid.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F27-SCR07: [Tạo lần thử mới](../../wr/refunds/retry.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F27-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F27-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F27-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F27-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F27-FN05: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F27-FN06: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F27-FN07: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F27-OP01 `listRefunds`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP02 `createRefund`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP03 `getRefund`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP04 `updateRefundDraft`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP05 `submitRefund`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP06 `confirmManualRefundPaid`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP07 `cancelUnpaidRefund`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP08 `listRefundAttempts`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP09 `requestOnlineRefund`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP10 `getRefundAttempt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP11 `reconcileRefundAttempt`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F27-OP12 `listRefundReservations`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** UNKNOWN keeps credit reserved; the source requestOnlineRefund operation has no reason body.
