# F05 — users: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F05-SCR01: [Tài khoản nhân viên](../../wr/users/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F05-SCR02: [Chi tiết tài khoản](../../wr/users/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F05-SCR03: [Tạo hoặc cập nhật nhân viên](../../wr/users/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F05-SCR04: [Đặt lại mật khẩu nhân viên](../../wr/users/password-reset.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F05-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F05-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F05-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F05-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F05-OP01 `listUsers`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F05-OP02 `createUser`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F05-OP03 `getUser`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F05-OP04 `updateUser`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F05-OP05 `resetUserPassword`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Group/status/admin-password changes invalidate live sessions; email uniqueness is case-insensitive.
