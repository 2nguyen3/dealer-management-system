# F08 — districts: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Manage active districts with a capacity derived from global business rules.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F08-SCR01 | Show active agency count and capacity per district. | Mã quận|Tên quận|Đại lý đang hoạt động | Full district|Inactive|Empty |
| F08-SCR02 | Inspect referencing agencies and eligibility for deletion. | Quận|Số đại lý|Trạng thái | Referenced|No capacity|Read-only |
| F08-SCR03 | Edit district metadata, not a district-specific capacity. | Mã|Tên|Trạng thái | Duplicate|Referenced delete|412 |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listDistricts` | GET `/districts` | (district.manage | agency.read | agency.manage) | — | M07/M07 | Owner | [Quận](../../wr/districts/index.html) |
| `createDistrict` | POST `/districts` | district.manage | — | M07/M07 | Owner | [Tạo hoặc cập nhật quận](../../wr/districts/editor.html) |
| `getDistrict` | GET `/districts/{districtId}` | (district.manage | agency.read | agency.manage) | — | M07/M07 | Owner | [Chi tiết quận](../../wr/districts/detail.html) |
| `updateDistrict` | PATCH `/districts/{districtId}` | district.manage | If-Match | M07/M07 | Owner | [Tạo hoặc cập nhật quận](../../wr/districts/editor.html) |
| `deleteDistrict` | DELETE `/districts/{districtId}` | district.manage | If-Match | M07/M07 | Owner | [Quận](../../wr/districts/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Capacity is global and server-enforced under concurrent dealer admissions.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
