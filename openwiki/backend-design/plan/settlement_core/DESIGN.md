# M16 design

## Pure seam

Immutable typed event inputs carry agency/document/revision/kind/date/order/amount,
receipt type/method/origin and protected refund debits. `plan_fifo` selects only
eligible invoice balances; `pair_credit_provenance` performs a conserved ordered
sweep. `plan_replay` rebuilds one agency's financial timeline in memory before any
ledger write. Charge precedes its automatic receipt at the same atomic checkpoint.
Return financial effects reduce origin debt first, then release paid provenance
into source-revision lots; return quantities/rounding remain owned by M23.

Lots are addressed by `(sourceRevisionId, originReceiptId)` plus existing identity.
Existing lot IDs and protected refund debit identities are retained. New lots are
created only when a valid replacement requires that receipt origin. Provisional
lot ordinals follow emission/persistence order so same-day FIFO remains unchanged
after real IDs are assigned. Before choosing return cash origins, reserve per-
receipt minima for this and later frozen returns of the same invoice. Once a
return creates credit the invoice is settled, so later payments cannot replenish
its paid provenance. Within each receipt distribute protected per-lot minima first,
then the unprotected remainder. Credit applications preserve future paid-refund
sources as well as active reservations; paid events release their protected amount.
Existing
financial effects are compared as multisets; unchanged sources append nothing.
Changed sources append exact negative reversals and replacements in REALLOCATE
batches with deterministic command-derived keys. No POSTED content/evidence edits.

## Persistence and lock sequence

1. Discover agency type without a lock, take type FOR SHARE, agency FOR SHARE,
   compare discovered type (40001 restart on change), balance FOR UPDATE.
2. Owning goods writers pre-acquire ordered product/unit/inventory locks according
   to full-backend protocol before document locks; M16 touches financial legs only.
3. Lock all affected agency documents/current revisions in ID order, then existing
   lots in ID order, reservation/attempt rows. Re-read after waits and authorize.
4. Build the complete plan; preserve all protected refund legs. Apply only changed
   source allocations; caller forces constraints after all other workflow legs.

The agency balance lock serializes compliant settlement/credit/refund writers.
Repositories perform bound SQL and never commit/rollback. Reads compute ledger
balances instead of relying on an unflushed cache. Reservation methods validate
current refund/source ownership, aggregate paid+reserved source cash, full amount,
and terminal/in-flight attempts. Release cannot free PENDING/UNKNOWN/SUCCESS money;
consume follows a posted refund with matching evidence in the caller transaction.

## Service boundary

`SettlementService` receives session/actor/request/live-authorize callback.
`replay` accepts a whitelisted owning function code and command UUID; posting an
internal receipt chooses permission from its type/method. `ReservationService`
enforces cash.refund.post after lock waits. Caller uses TransactionRunner for
request idempotency and commit/retry; substeps use deterministic UUID5 keys.

No route/router and no new response contracts. Financial capabilities describe
each persisted kind explicitly, without implying M23/M27/M29 HTTP completion.

## Actual persisted-kind register

`replay.CAPABILITIES` is the executable seven-kind register. The full-seed test
exercises the persisted agency histories and checks every frozen revision and
online/upfront/refund/reservation evidence row remains unchanged. Goods-neutral
kinds are covered by pure cases; their inventory effects remain outside M16.
`test_backdated_receipt_replays_credit_application_return_and_paid_refund_provenance`
inserts valid earlier cash before an existing application/return/paid refund,
replaces affected credit legs and preserves the exact paid refund lot/evidence.
Invalidating an ACTIVE source raises a genuine conflict and rolls back all new
source effects. Later HTTP writers must rerun these cases with their real callers;
this register does not close their D17 deployment/publication gates.
