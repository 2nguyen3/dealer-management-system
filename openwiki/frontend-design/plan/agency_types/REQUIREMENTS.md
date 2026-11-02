# F09 — agency_types: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Configure dealer types and debt limits without invalidating existing balances.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F09-SCR01 | Search active/inactive types and limit usage. | Mã loại|Hạn mức nợ|Số đại lý | Inactive|Empty|Read-only |
| F09-SCR02 | Inspect current limit, including terminated members. | Loại đại lý|Hạn mức|Đại lý tham chiếu | Used type|Stale balance|Delete blocked |
| F09-SCR03 | Edit exact whole-VND maxDebt with optimistic version. | Mã|Tên|Hạn mức nợ|Trạng thái | Invalid VND|Duplicate|412 |
| F09-SCR04 | Show server-listed affected dealers rather than a generic toast. | Đại lý|Dư nợ hiện tại|Hạn mức đề xuất | Active blocker|Terminated blocker|Reload |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listAgencyTypes` | GET `/agency-types` | (agency_type.manage | agency.read | agency.manage) | — | M08/M08 | Owner | [Loại đại lý](../../wr/agency_types/index.html) |
| `createAgencyType` | POST `/agency-types` | agency_type.manage | — | M08/M08 | Owner | [Tạo hoặc sửa loại đại lý](../../wr/agency_types/editor.html) |
| `getAgencyType` | GET `/agency-types/{typeId}` | (agency_type.manage | agency.read | agency.manage) | — | M08/M08 | Owner | [Chi tiết loại đại lý](../../wr/agency_types/detail.html) |
| `updateAgencyType` | PATCH `/agency-types/{typeId}` | agency_type.manage | If-Match | M08/M08 | Owner | [Tạo hoặc sửa loại đại lý](../../wr/agency_types/editor.html) |
| `deleteAgencyType` | DELETE `/agency-types/{typeId}` | agency_type.manage | If-Match | M08/M08 | Owner | [Loại đại lý](../../wr/agency_types/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Both active and terminated agencies can block lowering the limit.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
