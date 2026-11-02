# F10 — units: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Manage units and the integer-versus-three-decimal quantity policy.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F10-SCR01 | List units and fractional policy. | Mã đơn vị|Tên|Cho phép số lẻ | Inactive|Used|No matches |
| F10-SCR02 | Inspect product references and immutable usage constraints. | Mã|Mặt hàng sử dụng|Số lẻ | Recorded use|Delete blocked|Read-only |
| F10-SCR03 | Select fraction policy; recorded use may prevent changing it. | Mã|Tên|Cho phép số lẻ|Trạng thái | Invalid fraction|409 used|412 |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listUnits` | GET `/units` | (unit.manage | product.manage | inventory.read) | — | M09/M09 | Owner | [Đơn vị tính](../../wr/units/index.html) |
| `createUnit` | POST `/units` | unit.manage | — | M09/M09 | Owner | [Tạo hoặc sửa đơn vị](../../wr/units/editor.html) |
| `getUnit` | GET `/units/{unitId}` | (unit.manage | product.manage | inventory.read) | — | M09/M09 | Owner | [Chi tiết đơn vị](../../wr/units/detail.html) |
| `updateUnit` | PATCH `/units/{unitId}` | unit.manage | If-Match | M09/M09 | Owner | [Tạo hoặc sửa đơn vị](../../wr/units/editor.html) |
| `deleteUnit` | DELETE `/units/{unitId}` | unit.manage | If-Match | M09/M09 | Owner | [Đơn vị tính](../../wr/units/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Fractional policy is not a conversion system and cannot change after recorded use.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
