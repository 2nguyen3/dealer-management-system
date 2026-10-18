# F10 — units: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F10-SCR01: [Đơn vị tính](../../wr/units/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F10-SCR02: [Chi tiết đơn vị](../../wr/units/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F10-SCR03: [Tạo hoặc sửa đơn vị](../../wr/units/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F10-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F10-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F10-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F10-OP01 `listUnits`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F10-OP02 `createUnit`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F10-OP03 `getUnit`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F10-OP04 `updateUnit`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F10-OP05 `deleteUnit`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Fractional policy is not a conversion system and cannot change after recorded use.
