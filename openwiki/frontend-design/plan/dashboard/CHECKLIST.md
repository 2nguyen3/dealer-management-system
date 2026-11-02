# F31 — dashboard: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F31-SCR01: [Tổng quan](../../wr/dashboard/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F31-SCR02: [Góc nhìn kinh doanh](../../wr/dashboard/sales.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F31-SCR03: [Góc nhìn kho](../../wr/dashboard/warehouse.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F31-SCR04: [Góc nhìn kế toán](../../wr/dashboard/accounting.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F31-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F31-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F31-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F31-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F31-OP01 `getDashboard`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** D09 admission/section-permission mismatch requires a source decision before final integration.
