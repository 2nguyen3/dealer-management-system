# Full frontend — Tests

**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.

## Planning and wireframe verification

Run the [read-only frontend validator](validate_plan.py) after generating artifacts. It must check all 32 six-file children and matching index/multi-page HTML, 154 unique operation dispositions, correct method/path/gates against source, cross-links/anchors/assets, no missing child reference and no checked implementation gates without evidence. Browser-check representative narrow/desktop widths, keyboard interactions, color/text status, links/scenarios and contrast. These are artifact checks—not claims that backend money, database rollback or provider behavior passed.

## Future application tests

F01 installs locked tools: Vitest and Testing Library/user-event for actual symbols; source-derived MSW fixtures with response validation; Playwright for mocked and isolated real HTTP browser scenarios; accessibility audits. Declare **100% statement/branch coverage per newly owned behavioral file**, with meaningful success/failure/boundary for every completed symbol and no exclusions masking failure. Cover actual request method/path/headers/body/response media, 204, binary errors, exact strings/IDs, cursor/filter cancellation, If-Match/If-None-Match, keyed unknown retries, auth one-winner and permission truth tables. Tests against mocked fixtures do not prove backend persisted state.

Use backend [A01–A26 acceptance scenarios](../../../backend-design/plan/full_backend/TESTS.md#3-system-acceptance-scenarios) as cross-system references, especially A04–A20 for stock/settlement/refund/correction and A21–A26 for read products/price/replay. Require real browser/backend evidence for live closure; do not run on populated production/demo data as destructive fixture. Record actual nodes/commands/results, per-file branch coverage, environment, screenshots and missing prerequisites in the owning VERIFICATION.
