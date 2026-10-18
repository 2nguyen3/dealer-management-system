# F06 — permissions: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F06-SCR01: [Ma trận phân quyền](../../wr/permissions/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F06-SCR02: [Danh mục chức năng](../../wr/permissions/registry.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F06-SCR03: [Chi tiết chức năng](../../wr/permissions/function.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F06-SCR04: [Cập nhật quyền](../../wr/permissions/grant.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F06-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F06-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F06-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F06-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F06-OP01 `listFunctions`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F06-OP02 `getFunction`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F06-OP03 `listGroupPermissions`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F06-OP04 `getGroupPermission`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F06-OP05 `setGroupPermission`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Never send both If-Match and If-None-Match; isAllowed=false revokes without deleting the record.
