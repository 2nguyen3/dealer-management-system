# F01 — frontend_foundations: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/frontend_foundations/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F01-SCR01 [Mẫu giao diện](../../wr/frontend_foundations/index.html):** Shared operational patterns and system status. Visible fields: Trạng thái API|Mã yêu cầu|Chuyển mô-đun. Model explicitly: Loading|Empty|Forbidden|Unavailable.
- **F01-SCR02 [Mẫu biểu mẫu](../../wr/frontend_foundations/forms.html):** Reusable labels, validation and version-aware actions. Visible fields: Nhãn|Giá trị nhập|Lỗi trường|Phiên bản. Model explicitly: Invalid field|Stale ETag|Uncertain submit.
- **F01-SCR03 [Mẫu danh sách](../../wr/frontend_foundations/tables.html):** Cursor lists and results filtered without fabricated page counts. Visible fields: Tìm kiếm|Bộ lọc|Sắp xếp|Trang tiếp. Model explicitly: First-use empty|No matches|Stale cursor.
- **F01-SCR04 [Trạng thái hệ thống](../../wr/frontend_foundations/states.html):** Loading, partial reads, request IDs and safe recovery. Visible fields: Mã yêu cầu|Thử lại|Liên hệ hỗ trợ. Model explicitly: 429 retry|503 unavailable|412 review.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Source-derived JSON validation and exact amount, ID and business-date representations. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/frontend-foundations`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
