# Full frontend — Requirements

**Prepared:** 2026-10-03. **Status:** planning + static wireframes; no business frontend implementation. The [General Plan](../../GENERAL_PLAN.md) controls dependencies and [General Checklist](../../GENERAL_CHECKLIST.md) tracks evidence.

## Authority and constraints

Read [BA](../../../BA/DMS_exploration.md), confirmed [decisions](../../../database-design/business_decision_making.md), [database model](../../../database-design/README.md), [single target OpenAPI](../../../backend-design/API/openapi.json), [backend full plan](../../../backend-design/plan/full_backend/PLAN.md) and [runtime UI guidance](../../../../ui/AGENTS.md). Distinguish original BA proposals from selected Q01–Q15 and API target from implemented health/auth. No dealer portal, suppliers, tax invoicing, arbitrary SQL, bulk import or generic job-center contract is present.

## Cross-module requirements

- Role names are persona examples only. `/auth/me.allowedFunctions` controls read, action and deep-link availability, including `allOf`, `anyOf`, kind-dependent and conditional grants; MANAGEMENT has no bypass.
- Preserve exact bigint/string VND/quantity/rate, numeric CatalogId, untouched password bytes, date-only business dates and Vietnam-rendered instants. Ratios and derived quote overflow follow source decisions.
- Draft, pending/READY, posted and cancelled document status differ from revision status. Returns and refunds are actual events, not historical correction shortcuts. One document number may have multiple immutable revisions.
- Server owns historical stock/debt/credit validation, FIFO and provenance. UI distinguishes dealer debt, total credit, reserved and available credit and cash actually received versus declared, verified and receipted upfront evidence.
- Keep source ETags with full aggregate representations; parent ETags for lines; scoped stable Idempotency-Key for only source-keyed actions; 412/428, 409, 429 and unknown outcomes have distinct recovery.
- Reports use half-open dates, full-filter totals and content-negotiated XLSX/PDF; no unlimited client-side data fetch. Browser return URLs do not prove online payment success.
- Each F01–F32 slice has substantive linked screens, operation/grant/state inventory, success/failure/boundary tests, mocked versus real-browser evidence and later integration/deferred gates.

## Unresolved source decisions

Backend D07 sandbox deployment, D09 dashboard admission, D10 chatbot candidate continuation and D16 derived quote need explicit source/environment resolution; D17 persisted future-kind support controls publication. Lookup permissions for prepare-only flows and the bodyless refund retry reason require a reviewed contract/UX resolution. Wireframes illustrate the question and never silently add endpoint parameters or grants.
