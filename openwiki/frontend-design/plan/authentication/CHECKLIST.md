# F02 — authentication: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F02-SCR01: [Đăng nhập](../../wr/authentication/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F02-SCR02: [Quên mật khẩu](../../wr/authentication/forgot-password.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F02-SCR03: [Đặt lại mật khẩu](../../wr/authentication/reset-password.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F02-SCR04: [Đổi mật khẩu](../../wr/authentication/change-password.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F02-SCR05: [Phiên đăng nhập](../../wr/authentication/session.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F02-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F02-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F02-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F02-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F02-FN05: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F02-OP01 `login`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F02-OP02 `refreshTokens`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F02-OP03 `logout`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F02-OP04 `getCurrentUser`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F02-OP05 `changePassword`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F02-OP06 `requestPasswordReset`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F02-OP07 `resetPasswordWithToken`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Single-use refresh: one winner; wrong-current-password 401 must never trigger a refresh loop.
