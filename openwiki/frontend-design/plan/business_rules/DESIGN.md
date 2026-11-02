# F11 — business_rules: Design

**Status:** detailed design and paired wireframes prepared; application implementation and live integration open.
**Source:** [single target OpenAPI](../../../backend-design/API/openapi.json); [frontend roadmap](../../GENERAL_PLAN.md); [full frontend program](../full_frontend/PLAN.md).

## Proposed boundaries

Build the feature as `ui/src/features/business_rules/`; keep page assembly/router in `src/app/`, exact transport/schema/formatting/session/caching in `src/lib/` and visual primitives in `src/components/ui/`. Concrete files and actual symbols are recorded during implementation, not invented here. Use [program design](../full_frontend/DESIGN.md) for token/tab policy, query keys, source-derived validators, dates, ETags and retries.

## Page and interaction model

- **F11-SCR01 [Quy định hiện hành](../../wr/business_rules/index.html):** Display global capacity and exact price rate. Visible fields: Số đại lý tối đa/quận|Tỷ lệ giá xuất. Model explicitly: Read-only|Unavailable|412.
- **F11-SCR02 [Sửa quy định](../../wr/business_rules/editor.html):** Review versioned capacity/rate edits. Visible fields: Giới hạn/quận|Tỷ lệ giá xuất|Lưu. Model explicitly: Invalid decimal|Stale ETag|Derived price decision.
- **F11-SCR03 [Sức chứa không hợp lệ](../../wr/business_rules/capacity-conflict.html):** List districts currently exceeding the proposed capacity. Visible fields: Quận|Số đang hoạt động|Giới hạn mới. Model explicitly: Multiple blockers|Reload|Retry after change.

Resolve actions through the [source operation index](REQUIREMENTS.md#ownedconsumed-operations-and-grants). Navigation/search state is URL-bound; identity-scoped server reads must be cancelled and cleared when grants or account change. Operation-specific route guards are separate from action permissions. Source responses, not the synthetic wireframes, determine successful mutation projection and valid state transitions.

## Concurrency and failure

D16 must settle derived quote bounds before rate/price consumers publish. Preserve inputs for 412 review; reacquire parent/server ETag before editing. Use a unique intent key only on source-keyed operations, reuse for an unchanged uncertain request and never blindly mint a second money intent. Refresh affected cache keys and reread committed result. No optimistic adjustments to inventory, debt, received cash or reserved/available credit. Show server field pointers, safe blockers and request ID without echoing credentials. Form labels, accessible table headings, text status, focus-return dialogs and a narrow-screen reading order are requirements.

## Browser routes

Proposed route group: `/business-rules`; `/<id>` for supported detail, `/new` and `/<id>/edit` only where corresponding read/create/edit operations and permissions exist. These are frontend routes, not replacements for source API paths. F01–F03 use their documented foundation/auth/shell routes instead. Update this proposal before code if routing changes; deep links must guard both identity and source-specific permission.
