# F19 — upfront_payments: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/upfront_payments/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F19-SCR01 [Khoản trả ngay](../../wr/upfront_payments/index.html):** Show waiting verification and VERIFIED-but-unreceipted work. Visible fields: Phiếu xuất|Phiên bản|Số tiền khai báo|Trạng thái. Model explicitly: Waiting|Verified unreceipted|Consumed.
- **F19-SCR02 [Xác nhận tiền trả ngay](../../wr/upfront_payments/verify.html):** Record evidence, actual receipt instant, method and matching revision. Visible fields: Phiếu chờ xuất|Số tiền thực nhận|Thời điểm nhận|Phương thức. Model explicitly: Wrong revision|No actual money|Permission denied.
- **F19-SCR03 [Chi tiết xác nhận](../../wr/upfront_payments/detail.html):** Trace one evidence item to auto receipt or separate receipt. Visible fields: Phiên bản|Đã nhận|Phiếu thu liên kết|Trạng thái. Model explicitly: VERIFIED|CONSUMED|RECEIVED_SEPARATELY.
- **F19-SCR04 [Ghi nhận tiền riêng](../../wr/upfront_payments/receive-separately.html):** Handle verified money when delivery fails; issue remains a separate task. Visible fields: Tiền đã nhận|Phiếu thu riêng|Công nợ/ dư có. Model explicitly: Issue blocked|Already consumed|Uncertain result.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

VERIFIED is not a posted receipt; failed shipment must not make cash disappear. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/upfront-payments`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
