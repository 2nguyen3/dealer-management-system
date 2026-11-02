# F14 — document_workbench: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F14-SCR01: [Bàn làm việc chứng từ](../../wr/document_workbench/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F14-SCR02: [Sửa dòng hàng](../../wr/document_workbench/goods-editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F14-SCR03: [Soạn phiếu tài chính](../../wr/document_workbench/financial-editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F14-SCR04: [Nội dung đã thay đổi](../../wr/document_workbench/conflict.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F14-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F14-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F14-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F14-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F14-OP01 `listDocumentRevisions`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F14-OP02 `getDocumentRevision`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F14-OP03 `listDocumentLines`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F14-OP04 `createDocumentLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F14-OP05 `getDocumentLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F14-OP06 `replaceDocumentLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F14-OP07 `deleteDocumentLine`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Shared line/revision operations are full-gated at M28 even when an earlier kind can create lines.
