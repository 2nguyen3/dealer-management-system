# F01 — frontend_foundations: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F01-SCR01: [Mẫu giao diện](../../wr/frontend_foundations/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F01-SCR02: [Mẫu biểu mẫu](../../wr/frontend_foundations/forms.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F01-SCR03: [Mẫu danh sách](../../wr/frontend_foundations/tables.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F01-SCR04: [Trạng thái hệ thống](../../wr/frontend_foundations/states.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F01-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F01-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F01-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F01-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.

- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Source-derived JSON validation and exact amount, ID and business-date representations.
