# F05 — users: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Create and manage employee accounts; do not display returned passwords or claim reset unlocks a locked account.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F05-SCR01 | Find staff by email, group and status. | Email|Nhóm|Trạng thái | Duplicate email|Empty|Permission denied |
| F05-SCR02 | Show status, group and affected-session warning. | Tên|Email|Nhóm|Tình trạng | Locked|Changed group|Stale version |
| F05-SCR03 | Preserve password bytes and use group selection only when authorized. | Họ tên|Email|Nhóm|Mật khẩu khi tạo | Email conflict|Invalid form|Concurrent change |
| F05-SCR04 | Admin reset revokes all sessions; locked account stays locked. | Mật khẩu mới|Xác nhận thao tác | Missing permission|412|Session invalidated |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listUsers` | GET `/users` | users.manage | — | M04/M04 | Owner | [Tài khoản nhân viên](../../wr/users/index.html) |
| `createUser` | POST `/users` | users.manage | — | M04/M04 | Owner | [Tạo hoặc cập nhật nhân viên](../../wr/users/editor.html) |
| `getUser` | GET `/users/{userId}` | users.manage | — | M04/M04 | Owner | [Chi tiết tài khoản](../../wr/users/detail.html) |
| `updateUser` | PATCH `/users/{userId}` | users.manage | If-Match | M04/M04 | Owner | [Tạo hoặc cập nhật nhân viên](../../wr/users/editor.html) |
| `resetUserPassword` | POST `/users/{userId}/password-reset` | users.manage | If-Match | M04/M04 | Owner | [Đặt lại mật khẩu nhân viên](../../wr/users/password-reset.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- Group/status/admin-password changes invalidate live sessions; email uniqueness is case-insensitive.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
