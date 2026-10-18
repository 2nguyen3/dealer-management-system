# F13 — agencies: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F13-SCR01: [Đại lý](../../wr/agencies/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F13-SCR02: [Hồ sơ đại lý](../../wr/agencies/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F13-SCR03: [Tiếp nhận hoặc sửa đại lý](../../wr/agencies/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F13-SCR04: [Ngừng hợp tác](../../wr/agencies/terminate.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F13-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F13-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F13-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F13-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F13-OP01 `listAgencies`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F13-OP02 `createAgency`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F13-OP03 `getAgency`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F13-OP04 `updateAgency`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F13-OP05 `deleteAgency`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F13-OP06 `terminateAgency`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** No reactivation endpoint; eligible unused deletion depends on the shared D02 repair.
