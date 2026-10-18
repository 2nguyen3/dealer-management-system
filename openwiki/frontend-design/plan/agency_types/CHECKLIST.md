# F09 — agency_types: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F09-SCR01: [Loại đại lý](../../wr/agency_types/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F09-SCR02: [Chi tiết loại đại lý](../../wr/agency_types/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F09-SCR03: [Tạo hoặc sửa loại đại lý](../../wr/agency_types/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F09-SCR04: [Không thể hạ hạn mức](../../wr/agency_types/limit-conflict.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F09-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F09-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F09-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F09-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F09-OP01 `listAgencyTypes`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F09-OP02 `createAgencyType`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F09-OP03 `getAgencyType`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F09-OP04 `updateAgencyType`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F09-OP05 `deleteAgencyType`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Both active and terminated agencies can block lowering the limit.
