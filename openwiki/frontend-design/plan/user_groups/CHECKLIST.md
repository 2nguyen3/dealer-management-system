# F04 — user_groups: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F04-SCR01: [Nhóm nhân viên](../../wr/user_groups/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F04-SCR02: [Chi tiết nhóm](../../wr/user_groups/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F04-SCR03: [Tạo hoặc sửa nhóm](../../wr/user_groups/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F04-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F04-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F04-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F04-OP01 `listUserGroups`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F04-OP02 `createUserGroup`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F04-OP03 `getUserGroup`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F04-OP04 `updateUserGroup`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F04-OP05 `deleteUserGroup`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Delete requires groups.manage AND permissions.manage; grant cleanup is backend-atomic.
