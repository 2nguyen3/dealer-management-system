# F26 — online_payments: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F26-SCR01: [Thanh toán trực tuyến](../../wr/online_payments/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F26-SCR02: [Tạo thanh toán](../../wr/online_payments/create.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F26-SCR03: [Mở trang thanh toán](../../wr/online_payments/checkout.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F26-SCR04: [Chờ xác nhận từ cổng](../../wr/online_payments/return.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F26-SCR05: [Kết quả thanh toán](../../wr/online_payments/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F26-SCR06: [Sự kiện thanh toán](../../wr/online_payments/events.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F26-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F26-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F26-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F26-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F26-FN05: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F26-FN06: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F26-OP01 `listOnlinePayments`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F26-OP02 `createOnlinePayment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F26-OP03 `getOnlinePayment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F26-OP04 `listPaymentEvents`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F26-OP05 `reconcileOnlinePayment`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** The provider webhook is server-to-server, not a frontend action; no return URL proves SUCCESS.
