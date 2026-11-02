# F27 — refunds: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/refunds/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F27-SCR01 [Hoàn tiền](../../wr/refunds/index.html):** Find document status and independent attempt status. Visible fields: Phiếu hoàn|Nguồn thu|Đang dành|Kết quả. Model explicitly: DRAFT yet reserved|UNKNOWN|Paid.
- **F27-SCR02 [Lập yêu cầu hoàn](../../wr/refunds/editor.html):** Select one eligible original receipt, amount and method. Visible fields: Phiếu thu nguồn|Ngày dự kiến|Số tiền|Phương thức. Model explicitly: Two sources need two refunds|Source exhausted|Insufficient credit.
- **F27-SCR03 [Dành dư có để hoàn](../../wr/refunds/review.html):** Reserve available funds before manual or provider payout. Visible fields: Dư có hiện tại|Đang dành|Khả dụng sau. Model explicitly: Race with offset|Missing permission|412.
- **F27-SCR04 [Chi tiết phiếu hoàn](../../wr/refunds/detail.html):** Show paid, reserved, attempt and document states independently. Visible fields: Phiếu nguồn|Đã hoàn|Đang dành|Trạng thái xử lý. Model explicitly: DRAFT noneditable|Paid immutable|Safe cancel.
- **F27-SCR05 [Lần thử hoàn trực tuyến](../../wr/refunds/attempt.html):** Inspect PENDING, UNKNOWN, FAILED or SUCCESS with reconciliation. Visible fields: Mã lần thử|Kết quả|Thời điểm đối soát. Model explicitly: UNKNOWN retains reservation|Timeout|Verified failure.
- **F27-SCR06 [Xác nhận đã hoàn tiền](../../wr/refunds/confirm-paid.html):** Confirm observed cash/bank payout before committing financial effect. Visible fields: Bằng chứng thực trả|Số tiền|Ngày trả thực tế. Model explicitly: Unpaid|Double confirmation|Wrong source.
- **F27-SCR07 [Tạo lần thử mới](../../wr/refunds/retry.html):** Only after verified failure and released reservation, form a fresh attempt. Visible fields: Kết quả thất bại|Nguồn|Số tiền. Model explicitly: UNKNOWN blocks retry|New revision|No second payout.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

UNKNOWN keeps credit reserved; the source requestOnlineRefund operation has no reason body. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/refunds`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
