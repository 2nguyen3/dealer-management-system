# F12 — products: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Manage products while stock and current prices remain server-derived and read-only.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F12-SCR01 | Find products, current stock, current quote and low-stock flags. | Mã hàng|Đơn vị|Tồn hiện tại|Giá hiện tại | No price source|Low stock|Inactive |
| F12-SCR02 | Show latest business-date purchase source and inventory links. | Mã hàng|Nguồn giá|Tồn|Mức cảnh báo | Derived quote unusable|Source reversed|Read-only |
| F12-SCR03 | Edit name, unit and threshold; never let users set stock/price. | Tên|Đơn vị|Mức cảnh báo|Trạng thái | Unit used|Duplicate names|Eligible-delete conflict |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listProducts` | GET `/products` | (product.manage | inventory.read) | — | M11/M11 | Owner | [Mặt hàng](../../wr/products/index.html) |
| `createProduct` | POST `/products` | product.manage | — | M11/M11 | Owner | [Tạo hoặc sửa mặt hàng](../../wr/products/editor.html) |
| `getProduct` | GET `/products/{productId}` | (product.manage | inventory.read) | — | M11/M11 | Owner | [Chi tiết mặt hàng](../../wr/products/detail.html) |
| `updateProduct` | PATCH `/products/{productId}` | product.manage | If-Match | M11/M11 | Owner | [Tạo hoặc sửa mặt hàng](../../wr/products/editor.html) |
| `deleteProduct` | DELETE `/products/{productId}` | product.manage | If-Match | M11/M11 | Owner | [Mặt hàng](../../wr/products/index.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- D02 eligible deletion and D16 derived selling-price response policy must be resolved.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
