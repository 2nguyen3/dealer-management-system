# F32 — chatbot: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F32-SCR01: [Trợ lý tra cứu](../../wr/chatbot/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F32-SCR02: [Kết quả tra cứu](../../wr/chatbot/answer.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F32-SCR03: [Chọn đúng đại lý](../../wr/chatbot/agency-selection.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F32-SCR04: [Bổ sung thông tin](../../wr/chatbot/clarification.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F32-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F32-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F32-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F32-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F32-OP01 `queryChatbot`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** D10 candidate paging is not yet safe for chatbot-only grants; no invented cursor in the current contract.
