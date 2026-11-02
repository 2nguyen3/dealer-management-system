# F21 — stock_adjustments: Tests

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Layers and execution policy

Planning cases are **not executable test results**. On implementation, replace proposed responsibilities with every actual component, hook, validator, adapter, callback and helper; add their exact test nodes. F01 chooses locked Vitest/Testing Library/MSW/Playwright/a11y tooling. Require meaningful success, failure and boundary tests for each actual behavior and **100% statements and branches per newly owned behavioral file**, with no exclusions hiding reachable branches; use case assertions independently of coverage. Missing or skipped required cases keep the gate open.

## Proposed responsibility register

| Proposed responsibility | Screen | Success | Failure | Boundary/async | Layer |
| --- | --- | --- | --- | --- | --- |
| F21-FN01 (proposed index page/adapter) | F21-SCR01 | Render/use valid source data and navigate to the next valid screen. | Invalid response, missing permission or legal-state blocker shows safe actionable recovery, no mutation. | Empty/maximum/near-boundary input; stale request/ETag, abort or route change never repaints new identity. | Unit + mocked browser; real browser on published source operations |
| F21-FN02 (proposed editor page/adapter) | F21-SCR02 | Render/use valid source data and navigate to the next valid screen. | Invalid response, missing permission or legal-state blocker shows safe actionable recovery, no mutation. | Empty/maximum/near-boundary input; stale request/ETag, abort or route change never repaints new identity. | Unit + mocked browser; real browser on published source operations |
| F21-FN03 (proposed review page/adapter) | F21-SCR03 | Render/use valid source data and navigate to the next valid screen. | Invalid response, missing permission or legal-state blocker shows safe actionable recovery, no mutation. | Empty/maximum/near-boundary input; stale request/ETag, abort or route change never repaints new identity. | Unit + mocked browser; real browser on published source operations |
| F21-FN04 (proposed detail page/adapter) | F21-SCR04 | Render/use valid source data and navigate to the next valid screen. | Invalid response, missing permission or legal-state blocker shows safe actionable recovery, no mutation. | Empty/maximum/near-boundary input; stale request/ETag, abort or route change never repaints new identity. | Unit + mocked browser; real browser on published source operations |

## Operation/transport cases

| Test ID | Source operation | Paired page | Successful source behavior | Failure/recovery | Boundary |
| --- | --- | --- | --- | --- | --- |
| F21-OP01 | `listStockAdjustments` | index.html | Exact method/path/body/header and source-validated success/status; following authoritative reread | Source 401/403/409/412/428/429 or unavailable as applicable; no fake confirmed effect | Empty/large values, cursor/date/duplicate/unknown outcome appropriate to this operation |
| F21-OP02 | `createStockAdjustment` | editor.html | Exact method/path/body/header and source-validated success/status; following authoritative reread | Source 401/403/409/412/428/429 or unavailable as applicable; no fake confirmed effect | Empty/large values, cursor/date/duplicate/unknown outcome appropriate to this operation |
| F21-OP03 | `getStockAdjustment` | detail.html | Exact method/path/body/header and source-validated success/status; following authoritative reread | Source 401/403/409/412/428/429 or unavailable as applicable; no fake confirmed effect | Empty/large values, cursor/date/duplicate/unknown outcome appropriate to this operation |
| F21-OP04 | `updateStockAdjustmentDraft` | editor.html | Exact method/path/body/header and source-validated success/status; following authoritative reread | Source 401/403/409/412/428/429 or unavailable as applicable; no fake confirmed effect | Empty/large values, cursor/date/duplicate/unknown outcome appropriate to this operation |
| F21-OP05 | `postStockAdjustment` | review.html | Exact method/path/body/header and source-validated success/status; following authoritative reread | Source 401/403/409/412/428/429 or unavailable as applicable; no fake confirmed effect | Empty/large values, cursor/date/duplicate/unknown outcome appropriate to this operation |
| F21-OP06 | `correctStockAdjustment` | detail.html | Exact method/path/body/header and source-validated success/status; following authoritative reread | Source 401/403/409/412/428/429 or unavailable as applicable; no fake confirmed effect | Empty/large values, cursor/date/duplicate/unknown outcome appropriate to this operation |
| F21-OP07 | `cancelStockAdjustment` | detail.html | Exact method/path/body/header and source-validated success/status; following authoritative reread | Source 401/403/409/412/428/429 or unavailable as applicable; no fake confirmed effect | Empty/large values, cursor/date/duplicate/unknown outcome appropriate to this operation |

Adjustments do not create sales or change purchase-price source. For `anyOf`, exercise every single grant; for `allOf`, remove each grant independently; test conditional rights, next-request permission loss and deep links. Keyed actions test stable same-key retry versus changed payload; versioned actions test concurrent parent edits and preserved local form content. Numeric tests include max-ID, exact large VND and quantities; date tests include Vietnam-midnight and half-open ranges. Remote fixtures must validate against the source schema, including failure variants; mocks cannot prove database rollback or provider success.

## Required integrated evidence

Mocked browser scenarios exercise valid navigation, loading, forbidden, conflict, uncertain outcome, keyboard/focus and narrow viewport. Live scenarios wait for **Full published API, persisted-kind compatibility and backend evidence**; use real browser/network in an isolated backend environment. Re-check later correction/refund/provider consumers where this module's reads change. Record exact commands, cases, coverage JSON, environment and screenshots/results in VERIFICATION. Existing `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` run from `ui/`; tests/coverage/E2E scripts are proposed until F01 installs them.
