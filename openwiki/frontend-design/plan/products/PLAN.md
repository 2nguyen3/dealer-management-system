# F12 — products: Plan

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Goal and scope

Manage products while stock and current prices remain server-derived and read-only. This module owns its feature under `ui/src/features/products/` unless its responsibility belongs to shared `ui/src/lib/` or `ui/src/app/`. **Frontend prerequisites:** F10, F11. **Backend gates:** M11. The rendered [module wireframe](../../wr/products/index.html) is a prototype with synthetic data, not a runtime feature.

## Screens and paired wireframes

| Screen ID | File | Job | Required variants |
| --- | --- | --- | --- |
| F12-SCR01 | [Mặt hàng](../../wr/products/index.html) | Find products, current stock, current quote and low-stock flags. | No price source|Low stock|Inactive |
| F12-SCR02 | [Chi tiết mặt hàng](../../wr/products/detail.html) | Show latest business-date purchase source and inventory links. | Derived quote unusable|Source reversed|Read-only |
| F12-SCR03 | [Tạo hoặc sửa mặt hàng](../../wr/products/editor.html) | Edit name, unit and threshold; never let users set stock/price. | Unit used|Duplicate names|Eligible-delete conflict |

## API ownership and integration

| operationId | Method and source path | Source permissions | Request preconditions | Backend First/Full | UI role | Wireframe |
| --- | --- | --- | --- | --- | --- | --- |
| `listProducts` | GET `/products` | (product.manage | inventory.read) | — | M11/M11 | Owner | [Mặt hàng](../../wr/products/index.html) |
| `createProduct` | POST `/products` | product.manage | — | M11/M11 | Owner | [Tạo hoặc sửa mặt hàng](../../wr/products/editor.html) |
| `getProduct` | GET `/products/{productId}` | (product.manage | inventory.read) | — | M11/M11 | Owner | [Chi tiết mặt hàng](../../wr/products/detail.html) |
| `updateProduct` | PATCH `/products/{productId}` | product.manage | If-Match | M11/M11 | Owner | [Tạo hoặc sửa mặt hàng](../../wr/products/editor.html) |
| `deleteProduct` | DELETE `/products/{productId}` | product.manage | If-Match | M11/M11 | Owner | [Mặt hàng](../../wr/products/index.html) |

Full operation support and persisted-kind/deployment coverage, not First delivery alone, control live availability. Screen links may be authored before the backend publishes a route.

## Implementation packets

1. **P0 — Pair planning and wireframes:** review screens, source schema/policy/state, linked HTML, synthetic fixture and accessibility notes. Keep this planning gate separate from runtime evidence.
2. **P1 — Feature boundaries:** implement route/adapter/model, focused forms and read states; record actual symbols and their cases in TESTS.
3. **P2 — Safe actions:** add exact payloads, permission and state guards, parent ETags/intent keys when specified, duplicate-submit prevention, error recovery and authoritative reload.
4. **P3 — Verified integration:** run contract-mocked tests, then published-operation real HTTP/browser flows, accessibility and responsive checks. Re-run owning/reader regression when later workflows publish.
5. **P4 — Full closure:** all owned and consumed required operations/states, later integrations and evidence pass; update the general checklist without treating a mock or HTML click as backend success.

## Domain edge and deferred gates

D02 eligible deletion and D16 derived selling-price response policy must be resolved. Source-gap register: [D01–D17](../../../backend-design/plan/full_backend/DECISIONS.md). Backend R3/R4 are internal engineering milestones; full operational workflow handoff is R5. Use the [backend execution handoffs](../../../backend-design/plan/full_backend/EXECUTION.md). No new API path, business value or permission is implied by this plan.
