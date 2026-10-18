# F06 — permissions: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Expose the read-only function registry and create/update/revoke group grants with the correct preconditions.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F06-SCR01 | View effective grants by group and function. | Nhóm|Mã chức năng|Được phép | No grants|Grant changed elsewhere|Forbidden |
| F06-SCR02 | Inspect fixed system functions without user-created entries. | Mã chức năng|Tên|Mô tả | Read-only|No results|Denied |
| F06-SCR03 | Explain scope and linked group grants. | Mã chức năng|Nhóm được cấp | Not found|Read-only|Permission lost |
| F06-SCR04 | New grant uses If-None-Match: *; existing grant uses If-Match. | Nhóm|Chức năng|Cho phép | Create conflict|412|Revoked on next request |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listFunctions` | GET `/functions` | permissions.manage | — | M05/M05 | Owner | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `getFunction` | GET `/functions/{functionId}` | permissions.manage | — | M05/M05 | Owner | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `listGroupPermissions` | GET `/user-groups/{groupId}/permissions` | permissions.manage | — | M05/M05 | Owner | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `getGroupPermission` | GET `/user-groups/{groupId}/permissions/{functionId}` | permissions.manage | — | M05/M05 | Owner | [Ma trận phân quyền](../../wr/permissions/index.html) |
| `setGroupPermission` | PUT `/user-groups/{groupId}/permissions/{functionId}` | permissions.manage | If-Match, If-None-Match | M05/M05 | Owner | [Cập nhật quyền](../../wr/permissions/grant.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Never send both If-Match and If-None-Match; isAllowed=false revokes without deleting the record.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
