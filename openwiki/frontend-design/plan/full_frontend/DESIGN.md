# Full frontend — Design

**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.

## Application ownership

Keep React app composition, browser routing and guards in `ui/src/app/`; shared native fetch, schema validation, session, exact formatting, cache-key and capability infrastructure in `ui/src/lib/`; visual primitives in `ui/src/components/ui/`; module components/hooks/adapters under `ui/src/features/<feature>/`. F01 proposes React Router, TanStack Query, openapi-typescript-generated types, source-derived Ajv Draft 2020-12 + format validation, Vitest/Testing Library/MSW/Playwright; select locked versions and validate actual source composition before F01 code. Preserve plain CSS and StrictMode cleanup.

### Session policy: user-selected current tab

Store access JWT in memory and refresh token plus minimal session metadata in `sessionStorage` for same-tab reload. Do not use persistent localStorage tokens or pretend HttpOnly cookies exist. Refresh once per tab at a time; restore profile/grants through `/auth/me`; reset fragment is consumed and removed before third-party rendering. A duplicated tab can inherit copied sessionStorage: use tab ownership detection/coordination; the copy signs in independently rather than racing a single-use refresh. App-created links use `noopener`. Browser session restoration may keep sessionStorage alive; never promise closing a browser always signs out. An uncertain lost refresh reply or unavailable coordination goes to reauthentication, not repeated refresh with a consumed token. Logout with the last known refresh lineage token, clear private cache and abort pending reads; password change/reset leads to login. Test storage-denied and one-winner races. Never log or include tokens in URLs except the specified one-time reset fragment during initial receipt.

### Transport and state

Derive request/response validators and types from the source OpenAPI rather than maintaining another API. Select correct JSON/204/binary response by status/media, map safe Error field pointers and Retry-After, keep ETag including quotes, apply If-Match/If-None-Match as declared, and generate stable intent UUID only where declared. Let query keys include identity, operation, filters/sort/cursor and resource ID; invalidate owner and dependent stock/debt/credit/history/report readers after confirmed mutations. Abort stale reads; never optimistic-post ledger values. Explicitly distinguish backend capability unavailable from failed health, empty results and denied grants. Direct cross-origin business calls also require M02 CORS request/expose headers; proxy defaults keep same-origin calls.

### Wireframe system

Static HTML pages are real content with relative links; local CSS/JS only improves scenario switching and navigation. Each file renders meaningful content without JavaScript. English technical contract IDs live in annotations; user-facing copy uses Vietnamese business terminology. Scenario balances follow the backend A01–A26 reference fixtures; no hidden computation engine or API calls.
