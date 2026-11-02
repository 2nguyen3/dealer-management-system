# F18 — payment_receipts: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/payment_receipts/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F18-SCR01 [Phiếu thu](../../wr/payment_receipts/index.html):** Find manual, automatic and online sources with method/status filters. Visible fields: Đại lý|Loại thu|Phương thức|Số tiền. Model explicitly: Generated read-only|Empty|Canceled.
- **F18-SCR02 [Lập phiếu thu công nợ](../../wr/payment_receipts/editor.html):** Choose same dealer, positive amount, method and business date. Visible fields: Đại lý|Ngày nghiệp vụ|Tiền thu|Phương thức. Model explicitly: Future invoice|Overcollection|Validation.
- **F18-SCR03 [Xác nhận tiền đã thu](../../wr/payment_receipts/review.html):** Review real cash evidence; allocation is automatic FIFO. Visible fields: Số tiền|Dư nợ đủ điều kiện|Người xác nhận. Model explicitly: Insufficient eligible debt|412|Unknown result.
- **F18-SCR04 [Chi tiết phiếu thu](../../wr/payment_receipts/detail.html):** Show posted money and read-only allocations to issues. Visible fields: Phiếu thu|Tiền thực nhận|Phân bổ FIFO|Dư nợ sau. Model explicitly: Auto receipt immutable|Correction|Cancel blocked.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

Never offer manual selection or mutation of invoice allocations. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/payment-receipts`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
