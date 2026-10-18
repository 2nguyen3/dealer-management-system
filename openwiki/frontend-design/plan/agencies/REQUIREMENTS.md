# F13 — agencies: Requirements

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Authority and traceability

Selected [Q01–Q15 business decisions](../../../database-design/business_decision_making.md) supersede conflicting historical [BA material](../../../BA/DMS_exploration.md). The [backend operation inventory](../../../backend-design/plan/full_backend/OPERATIONS.md) supplies First/Full gates; exact request/response fields, error codes, conditional permissions and body/media definitions live only in the OpenAPI. Maintain dealer profiles and irrevocable termination without erasing outstanding obligations.

| Screen ID | Visible requirement | Input or status evidence | Recovery |
| --- | --- | --- | --- |
| F13-SCR01 | Search by immutable dealer code and distinguish duplicate names by district. | Mã đại lý|Tên|Quận|Nợ hiện tại | Duplicate names|Terminated|No matches |
| F13-SCR02 | Link issues, receipts, debt and credit without editing balances. | Mã|Loại|Quận|Hạn mức|Nợ|Dư có | Terminated with debt|Read-only|Missing lookup grant |
| F13-SCR03 | Enter required email and select eligible active type/district. | Tên|Email|Loại|Quận|Ngày tiếp nhận|Điện thoại | District full|Limit too low|412 |
| F13-SCR04 | Require a reason and show continuing collection/return/refund rights. | Lý do ngừng|Dư nợ còn lại|Xác nhận | Already terminated|No reopen|Uncertain intent |

## Owned/consumed operations and grants

| operationId | Method and source path | allOf/anyOf from source | Headers | First/Full | Relationship | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| `listAgencies` | GET `/agencies` | (agency.read | agency.manage) | — | M12/M12 | Owner | [Đại lý](../../wr/agencies/index.html) |
| `createAgency` | POST `/agencies` | agency.manage | — | M12/M12 | Owner | [Tiếp nhận hoặc sửa đại lý](../../wr/agencies/editor.html) |
| `getAgency` | GET `/agencies/{agencyId}` | (agency.read | agency.manage) | — | M12/M12 | Owner | [Hồ sơ đại lý](../../wr/agencies/detail.html) |
| `updateAgency` | PATCH `/agencies/{agencyId}` | agency.manage | If-Match | M12/M12 | Owner | [Tiếp nhận hoặc sửa đại lý](../../wr/agencies/editor.html) |
| `deleteAgency` | DELETE `/agencies/{agencyId}` | agency.manage | If-Match | M12/M12 | Owner | [Đại lý](../../wr/agencies/index.html) |
| `terminateAgency` | POST `/agencies/{agencyId}/terminate` | agency.manage | If-Match, Idempotency-Key | M12/M12 | Owner | [Ngừng hợp tác](../../wr/agencies/terminate.html) |

For each linked action, read the **source operation itself** for query filters, requestBody, response schema, security, status and content negotiation; the table is an index, not a copied API definition. Business actions must be blocked when their permission, legal state, required lookup or published backend capability is absent. Source-specific conditional rights, including stock-count nonzero differences and money-dependent issue cancellation, are evaluated at action time. Read grants do not imply mutation grants. Frontend checks supplement rather than replace server authorization.

## Invariants, boundary and failure requirements

- No reactivation endpoint; eligible unused deletion depends on the shared D02 repair.
- Keep `Id` BIGINT and money/quantity/rate decimal strings exact; `CatalogId` is integer. Money entered by a user is whole VNĐ; never round fractional input silently. Dates remain date-only or UTC instants rendered in Vietnam as prescribed.
- Lists use opaque cursor, `hasMore`, bounded filters and operation-specific sort; no offset/page-count fiction. Distinguish empty, filtered-no-results, forbidden, unavailable, 429, 409, 412 and 428.
- Mutations reload authoritative detail, affected ledgers/balances and related history; timeouts mean unknown outcomes, especially for money. `204` is an empty response. Parent ETags and stable keys apply only where the specific operation declares them.
- Each screen's fields/states must be represented in its HTML. Prototype navigation is not live application behavior; the owning backend must pass its full gate before a real UI action can be enabled.
