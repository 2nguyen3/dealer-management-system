# F25 — credit_applications: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F25-SCR01: [Bù trừ dư có](../../wr/credit_applications/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F25-SCR02: [Lập phiếu bù trừ](../../wr/credit_applications/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F25-SCR03: [Xác nhận bù trừ](../../wr/credit_applications/review.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F25-SCR04: [Chi tiết bù trừ](../../wr/credit_applications/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F25-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F25-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F25-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F25-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F25-OP01 `listCreditApplications`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F25-OP02 `createCreditApplication`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F25-OP03 `getCreditApplication`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F25-OP04 `updateCreditApplicationDraft`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F25-OP05 `postCreditApplication`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F25-OP06 `correctCreditApplication`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F25-OP07 `cancelCreditApplication`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Credit application is not new cash; posted correction/cancel full-gated at M29.
