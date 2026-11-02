# F32 — chatbot: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/chatbot/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F32-SCR01 [Trợ lý tra cứu](../../wr/chatbot/index.html):** Ask about dealer debt, inventory or sales without arbitrary SQL. Visible fields: Loại câu hỏi|Nội dung|Khoảng ngày. Model explicitly: Unsupported query|403|No history requirement.
- **F32-SCR02 [Kết quả tra cứu](../../wr/chatbot/answer.html):** Explain authorized answer and link to source read product. Visible fields: Câu hỏi|Kết quả|Dữ liệu nguồn. Model explicitly: No inferred owner|Current asOf|No mutation.
- **F32-SCR03 [Chọn đúng đại lý](../../wr/chatbot/agency-selection.html):** Present code/name/district without revealing candidate balances. Visible fields: Mã đại lý|Tên|Quận. Model explicitly: Duplicate names|26+ D10 gate|No broadened grant.
- **F32-SCR04 [Bổ sung thông tin](../../wr/chatbot/clarification.html):** Ask only for missing agency/product/period fields. Visible fields: Mã đại lý|Mặt hàng|Từ ngày|Đến ngày. Model explicitly: Missing context|Unsupported|Read denied.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

D10 candidate paging is not yet safe for chatbot-only grants; no invented cursor in the current contract. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/chatbot`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
