# F24 — agency_credit: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F24-SCR01: [Dư có đại lý](../../wr/agency_credit/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F24-SCR02: [Các lô dư có](../../wr/agency_credit/lots.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F24-SCR03: [Nguồn một lô dư có](../../wr/agency_credit/lot.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F24-SCR04: [Sổ dư có](../../wr/agency_credit/statement.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F24-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F24-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F24-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F24-FN04: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F24-OP01 `listAgencyCreditLots`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F24-OP02 `getCreditLot`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F24-OP03 `listAgencyCreditEntries`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F24-OP04 `getAgencyBalance`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** Available credit excludes live reservations; later F27 refund states require regression.
