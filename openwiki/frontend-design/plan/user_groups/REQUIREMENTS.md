# F04 — user_groups: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Manage groups without deleting a group still referenced by active or locked staff.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F04-SCR01 | Search groups and current membership counts. | Mã nhóm|Tên nhóm|Số nhân viên | Empty|Filtered|Read-only |
| F04-SCR02 | Inspect members, grants and safe delete availability. | Mã nhóm|Nhân viên|Quyền | Referenced by LOCKED user|Delete forbidden|412 |
| F04-SCR03 | Create a distinct code or edit with a strong version. | Mã nhóm|Tên nhóm|Lưu | Duplicate code|Validation|Concurrent edit |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listUserGroups` | GET `/user-groups` | (groups.manage | users.manage | permissions.manage) | — | M03/M03 | Owner | [Nhóm nhân viên](../../wr/user_groups/index.html) |
| `createUserGroup` | POST `/user-groups` | groups.manage | — | M03/M03 | Owner | [Tạo hoặc sửa nhóm](../../wr/user_groups/editor.html) |
| `getUserGroup` | GET `/user-groups/{groupId}` | (groups.manage | users.manage | permissions.manage) | — | M03/M03 | Owner | [Chi tiết nhóm](../../wr/user_groups/detail.html) |
| `updateUserGroup` | PATCH `/user-groups/{groupId}` | groups.manage | If-Match | M03/M03 | Owner | [Tạo hoặc sửa nhóm](../../wr/user_groups/editor.html) |
| `deleteUserGroup` | DELETE `/user-groups/{groupId}` | groups.manage & permissions.manage | If-Match | M03/M03 | Owner | [Nhóm nhân viên](../../wr/user_groups/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Delete requires groups.manage AND permissions.manage; grant cleanup is backend-atomic.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
