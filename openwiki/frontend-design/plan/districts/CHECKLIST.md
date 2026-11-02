# F08 — districts: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F08-SCR01: [Quận](../../wr/districts/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F08-SCR02: [Chi tiết quận](../../wr/districts/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F08-SCR03: [Tạo hoặc cập nhật quận](../../wr/districts/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F08-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F08-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F08-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F08-OP01 `listDistricts`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F08-OP02 `createDistrict`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F08-OP03 `getDistrict`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F08-OP04 `updateDistrict`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F08-OP05 `deleteDistrict`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Capacity is global and server-enforced under concurrent dealer admissions.
