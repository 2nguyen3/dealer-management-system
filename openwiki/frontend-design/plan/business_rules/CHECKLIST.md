# F11 — business_rules: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F11-SCR01: [Quy định hiện hành](../../wr/business_rules/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F11-SCR02: [Sửa quy định](../../wr/business_rules/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F11-SCR03: [Sức chứa không hợp lệ](../../wr/business_rules/capacity-conflict.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F11-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F11-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F11-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F11-OP01 `getBusinessRules`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F11-OP02 `updateBusinessRules`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** D16 must settle derived quote bounds before rate/price consumers publish.
