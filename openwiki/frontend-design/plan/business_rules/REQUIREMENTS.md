# F11 — business_rules: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Manage the singleton district capacity and selling-price multiplier without rewriting snapshots.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F11-SCR01 | Display global capacity and exact price rate. | Số đại lý tối đa/quận|Tỷ lệ giá xuất | Read-only|Unavailable|412 |
| F11-SCR02 | Review versioned capacity/rate edits. | Giới hạn/quận|Tỷ lệ giá xuất|Lưu | Invalid decimal|Stale ETag|Derived price decision |
| F11-SCR03 | List districts currently exceeding the proposed capacity. | Quận|Số đang hoạt động|Giới hạn mới | Multiple blockers|Reload|Retry after change |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `getBusinessRules` | GET `/business-rules` | (rules.manage | agency.manage | stock.issue.prepare | inventory.read) | — | M10/M10 | Owner | [Quy định hiện hành](../../wr/business_rules/index.html) |
| `updateBusinessRules` | PATCH `/business-rules` | rules.manage | If-Match | M10/M10 | Owner | [Sửa quy định](../../wr/business_rules/editor.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- D16 must settle derived quote bounds before rate/price consumers publish.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
