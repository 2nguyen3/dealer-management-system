# F26 — online_payments: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/online_payments/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F26-SCR01 [Thanh toán trực tuyến](../../wr/online_payments/index.html):** Find pending, success, failed and expired attempts. Visible fields: Đại lý|Số tiền|Mã giao dịch|Trạng thái. Model explicitly: Pending|Failed/expired|Late success.
- **F26-SCR02 [Tạo thanh toán](../../wr/online_payments/create.html):** Start one bounded intent against current debt and supported sandbox. Visible fields: Đại lý|Số tiền|Cổng thử nghiệm. Model explicitly: Unsupported provider|Amount exceeds debt|Uncertain setup.
- **F26-SCR03 [Mở trang thanh toán](../../wr/online_payments/checkout.html):** Present checkout only when server supplies a trusted URL. Visible fields: Số tiền|Địa chỉ thanh toán|Hạn. Model explicitly: 202 setup pending|URL unavailable|Return without proof.
- **F26-SCR04 [Chờ xác nhận từ cổng](../../wr/online_payments/return.html):** Browser return is not verified money; poll existing payment. Visible fields: Mã giao dịch|Kiểm tra trạng thái. Model explicitly: Still pending|Return failed|Reconcile.
- **F26-SCR05 [Kết quả thanh toán](../../wr/online_payments/detail.html):** Show full verified receipt and any excess dealer credit. Visible fields: Tiền thực nhận|Đã trừ nợ|Dư có tạo|Phiếu thu. Model explicitly: Late SUCCESS|Duplicate callback|Failed.
- **F26-SCR06 [Sự kiện thanh toán](../../wr/online_payments/events.html):** Read authorized normalized event summaries only. Visible fields: Thời gian|Nguồn|Trạng thái xác minh. Model explicitly: Invalid signature hidden|Repeated event|No events.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

The provider webhook is server-to-server, not a frontend action; no return URL proves SUCCESS. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/online-payments`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
