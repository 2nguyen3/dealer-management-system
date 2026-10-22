# F20 — receivables: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/receivables/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F20-SCR01 [Công nợ](../../wr/receivables/index.html):** Search dealer balances with current asOf time. Visible fields: Mã đại lý|Nợ hiện tại|Hạn mức|Còn lại. Model explicitly: No debt|Terminated dealer|Forbidden.
- **F20-SCR02 [Công nợ đại lý](../../wr/receivables/agency.html):** Display separate debt, credit, reservation and headroom. Visible fields: Nợ phải thu|Dư có|Đang dành|Khả dụng. Model explicitly: Simultaneous debt and credit|Unavailable|Stale.
- **F20-SCR03 [Công nợ phiếu xuất](../../wr/receivables/invoice.html):** Compare original remainder with current outstanding and settlement sources. Visible fields: Lúc xuất còn|Đã phân bổ|Còn nợ hiện tại. Model explicitly: SETTLED by return|SETTLED by credit|Partial.
- **F20-SCR04 [Sổ công nợ](../../wr/receivables/statement.html):** Review opening, dated changes, closing and effective history. Visible fields: Từ ngày|Đến ngày|Số dư đầu|Biến động. Model explicitly: No movements|Backdated replay|Correction.
- **F20-SCR05 [Phân bổ thanh toán](../../wr/receivables/allocations.html):** Inspect source receipt/credit and target issue with current/reversed legs. Visible fields: Nguồn tiền|Phiếu được trừ|Ngày nghiệp vụ|Hiệu lực. Model explicitly: Reversed|Auto upfront|No edit.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

The agency balance resource belongs to F20 and is reused—not duplicated—by F24. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/receivables`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
