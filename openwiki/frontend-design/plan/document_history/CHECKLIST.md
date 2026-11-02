# F28 — document_history: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F28-SCR01: [Tra cứu chứng từ](../../wr/document_history/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F28-SCR02: [Lịch sử phiên bản](../../wr/document_history/revisions.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F28-SCR03: [Nội dung phiên bản cũ](../../wr/document_history/revision.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F28-SCR04: [So sánh hai phiên bản](../../wr/document_history/compare.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F28-SCR05: [Bản in chứng từ](../../wr/document_history/print.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F28-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F28-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F28-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F28-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F28-FN05: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F28-OP01 `searchDocuments`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F28-OP02 `listDocumentRevisions`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F28-OP03 `getDocumentRevision`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F28-OP04 `listDocumentLines`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F28-OP05 `createDocumentLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F28-OP06 `getDocumentLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F28-OP07 `replaceDocumentLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F28-OP08 `deleteDocumentLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F28-OP09 `printDocument`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Bearer-protected print requires fetch/blob or authenticated HTML handling, not a bare hyperlink.
