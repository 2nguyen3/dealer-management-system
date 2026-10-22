# F20 — receivables: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F20-SCR01: [Công nợ](../../wr/receivables/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F20-SCR02: [Công nợ đại lý](../../wr/receivables/agency.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F20-SCR03: [Công nợ phiếu xuất](../../wr/receivables/invoice.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F20-SCR04: [Sổ công nợ](../../wr/receivables/statement.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F20-SCR05: [Phân bổ thanh toán](../../wr/receivables/allocations.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F20-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F20-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F20-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F20-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F20-FN05: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F20-OP01 `listReceivables`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F20-OP02 `getAgencyBalance`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F20-OP03 `listAgencyInvoiceBalances`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F20-OP04 `getInvoiceBalance`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F20-OP05 `listAgencyReceivableEntries`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F20-OP06 `listDocumentAllocations`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** The agency balance resource belongs to F20 and is reused—not duplicated—by F24.
