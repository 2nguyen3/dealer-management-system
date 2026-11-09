# F03 — application_shell: Tests

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Layers and execution policy

Planning cases are **not executable test results**. On implementation, replace proposed responsibilities with every actual component, hook, validator, adapter, callback and helper; add their exact test nodes. F01 chooses locked Vitest/Testing Library/MSW/Playwright/a11y tooling. Require meaningful success, failure and boundary tests for each actual behavior and **100% statements and branches per newly owned behavioral file**, with no exclusions hiding reachable branches; use case assertions independently of coverage. Missing or skipped required cases keep the gate open.

## Proposed responsibility register

| Proposed responsibility | Screen | Success | Failure | Boundary/async | Layer |
| --- | --- | --- | --- | --- | --- |
| F03-FN01 (proposed index page/adapter) | F03-SCR01 | Render/use valid source data and navigate to the next valid screen. | Invalid response, missing permission or legal-state blocker shows safe actionable recovery, no mutation. | Empty/maximum/near-boundary input; stale request/ETag, abort or route change never repaints new identity. | Unit + mocked browser; real browser on published source operations |
| F03-FN02 (proposed navigation page/adapter) | F03-SCR02 | Render/use valid source data and navigate to the next valid screen. | Invalid response, missing permission or legal-state blocker shows safe actionable recovery, no mutation. | Empty/maximum/near-boundary input; stale request/ETag, abort or route change never repaints new identity. | Unit + mocked browser; real browser on published source operations |
| F03-FN03 (proposed access-denied page/adapter) | F03-SCR03 | Render/use valid source data and navigate to the next valid screen. | Invalid response, missing permission or legal-state blocker shows safe actionable recovery, no mutation. | Empty/maximum/near-boundary input; stale request/ETag, abort or route change never repaints new identity. | Unit + mocked browser; real browser on published source operations |
| F03-FN04 (proposed not-found page/adapter) | F03-SCR04 | Render/use valid source data and navigate to the next valid screen. | Invalid response, missing permission or legal-state blocker shows safe actionable recovery, no mutation. | Empty/maximum/near-boundary input; stale request/ETag, abort or route change never repaints new identity. | Unit + mocked browser; real browser on published source operations |

## Operation/transport cases

| Test ID | Source operation | Paired page | Successful source behavior | Failure/recovery | Boundary |
| --- | --- | --- | --- | --- | --- |
| F03-OP00 | No owned business operation | index.html | Preserve starter health and shared state | Unavailable/denied | Timeout/abort |

Read-only access remains possible without manage grants; no MANAGEMENT bypass. For `anyOf`, exercise every single grant; for `allOf`, remove each grant independently; test conditional rights, next-request permission loss and deep links. Keyed actions test stable same-key retry versus changed payload; versioned actions test concurrent parent edits and preserved local form content. Numeric tests include max-ID, exact large VND and quantities; date tests include Vietnam-midnight and half-open ranges. Remote fixtures must validate against the source schema, including failure variants; mocks cannot prove database rollback or provider success.

## Required integrated evidence

## Actual Alignment Register, 2026-10-30

| Actual symbol | Success | Failure | Boundary |
| --- | --- | --- | --- |
| `allowsNavigation`, `routePermissions` | Each endpoint reader reaches its route/menu | Missing member of report allOf denies access | Empty grants, unknown route, every anyOf member, no role bypass |
| `ShellLayout` | Local menu filtering and navigation | Logout failure stays actionable | Escape, focus return, mobile hidden links, zero shell business requests |
| `ProtectedRoute` | Current grants admit route | Unauthenticated redirect/denied page | Loading, search preserved, explicit policy overrides old narrower route prop |
| `HomePage` | Authorized task links | No grants yields explicit empty state | No business fetch, no fabricated metrics |

Use colocated/unit tests and `src/test/shell_and_navigation.test.tsx`; browser
viewport and keyboard evidence is recorded separately. Full closure still requires
the existing per-file 100% statement/branch gate, not a passing build alone.

Mocked browser scenarios exercise valid navigation, loading, forbidden, conflict, uncertain outcome, keyboard/focus and narrow viewport. Live scenarios wait for **Full published API, persisted-kind compatibility and backend evidence**; use real browser/network in an isolated backend environment. Re-check later correction/refund/provider consumers where this module's reads change. Record exact commands, cases, coverage JSON, environment and screenshots/results in VERIFICATION. Existing `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` run from `ui/`; tests/coverage/E2E scripts are proposed until F01 installs them.
