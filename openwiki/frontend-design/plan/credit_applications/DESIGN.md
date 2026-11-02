# F25 — credit_applications: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/credit_applications/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F25-SCR01 [Bù trừ dư có](../../wr/credit_applications/index.html):** Search application drafts and posted offsets. Visible fields: Phiếu|Đại lý|Số bù|Trạng thái. Model explicitly: No applications|Cancelled|Read-only.
- **F25-SCR02 [Lập phiếu bù trừ](../../wr/credit_applications/editor.html):** Choose dealer, date and amount only within unreserved credit/debt. Visible fields: Đại lý|Ngày nghiệp vụ|Số bù trừ. Model explicitly: Reserved funds|Insufficient debt|Validation.
- **F25-SCR03 [Xác nhận bù trừ](../../wr/credit_applications/review.html):** Review available sources and FIFO result without creating a receipt. Visible fields: Dư có khả dụng|Nợ đủ điều kiện|Tiền thu mới: 0đ. Model explicitly: Credit race|412|No cash.
- **F25-SCR04 [Chi tiết bù trừ](../../wr/credit_applications/detail.html):** Trace consumed lots and settled issues. Visible fields: Phiếu nguồn|Phiếu nợ|Số bù|Tiền thu. Model explicitly: Corrected|Source reserved|Posted immutable.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Credit application is not new cash; posted correction/cancel full-gated at M29. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/credit-applications`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
