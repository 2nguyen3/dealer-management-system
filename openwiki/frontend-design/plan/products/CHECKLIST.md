# F12 — products: Checklist

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Paired planning and wireframes

- [x] F12-SCR01: [Mặt hàng](../../wr/products/index.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F12-SCR02: [Chi tiết mặt hàng](../../wr/products/detail.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] F12-SCR03: [Tạo hoặc sửa mặt hàng](../../wr/products/editor.html) exists with visible fields and state variants; verify interactive behavior separately in VERIFICATION.
- [x] Source operation IDs, First/Full gates and owner/consumer relation indexed in [REQUIREMENTS](REQUIREMENTS.md); planning does not establish runtime availability.
- [ ] Browser/keyboard/link/viewport review of this module's actual HTML recorded with exact result.

## Implementation and live gates (all open)

- [ ] F12-FN01: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F12-FN02: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F12-FN03: actual symbol(s), success/failure/boundary tests, coverage and linked screen evidence recorded.
- [ ] F12-OP01 `listProducts`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F12-OP02 `createProduct`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F12-OP03 `getProduct`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F12-OP04 `updateProduct`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] F12-OP05 `deleteProduct`: source contract, permissions, legal states, full backend publication, mocked and live browser cases pass.
- [ ] Permission and legal-state variants, safe retries/versions, response validation, precision and authoritative reload verified.
- [ ] Accessibility, responsive layout, direct/proxied browser flow and later dependency regressions pass.
- [ ] Actual command/node/coverage/browser/backend evidence in VERIFICATION; no required skip/xfail/unrun cases.
- [ ] Full module closure includes every deferred kind/state/action and updates General Checklist.

**Key dependency:** D02 eligible deletion and D16 derived selling-price response policy must be resolved.
