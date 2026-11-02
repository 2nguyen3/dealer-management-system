# M27 — refunds

## VNPAY integration — 2026-10-25

Use the [native delivery design](../online_payments/VNPAY.md). Bind outbound requests
to detached original-payment and durable-attempt data; preserve the initiating actor,
creation dates and stable RequestId across recovery. Native response/query ambiguity
or a result about the original payment cannot release/consume refund reservations.
Retain existing twelve-operation and source-conservation gates before publication.

Prepared before code; M25 core verified, M26 engineering in progress/unpublished with
D07 external acceptance blocked. Implement manual no-network slice first, then online
transport/recovery using M26 adapter. No public refund operation is mounted until all
valid method branches and required publication gates pass. Canonical twelve IDs are
in `../full_backend/OPERATIONS.md`; HTTP source remains `../../API/openapi.json`.

Phases: source-bound draft/read/update → reserve/manual confirmation/cancel → online
attempt/unknown/reconcile/fresh-revision retry → all twelve route contracts → independent
money races/rollback/restart → exact coverage/reviews → isolated deployment/acceptance.
Reuse ReservationService/AvailableCreditService/SettlementService and durable commands.
