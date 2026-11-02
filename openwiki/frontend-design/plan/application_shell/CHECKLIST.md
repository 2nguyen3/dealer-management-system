# F03 — application_shell: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F03-SCR01: [Khung ứng dụng](../../wr/application_shell/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F03-SCR02: [Điều hướng theo quyền](../../wr/application_shell/navigation.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F03-SCR03: [Không có quyền truy cập](../../wr/application_shell/access-denied.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F03-SCR04: [Không tìm thấy](../../wr/application_shell/not-found.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F03-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F03-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F03-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F03-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.

- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Read-only access remains possible without manage grants; no MANAGEMENT bypass.
