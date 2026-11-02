# M24 design and confirmed test seams

CreditRepository reads credit_availability joined to source revision/document and
uses bound SQL for lot pages/statement. AgencyCreditService owns authorization,
exact projections/interval/cursor validation. No duplicate M20 agency balance route.
Whole-filter statement totals and page share one SQL snapshot; full-ledger window
precedes display filters. Preserve reversals/source revisions, no contact-profile fields.

AvailableCreditService composes M16 SettlementService.lock and repository.available,
rechecks writer permission after agency/history locks, returns exact available lots
in existing source-date/id order. Callers own preceding stock/master locks and final
constraint/commit boundary. It neither consumes nor reserves credit.

Confirmed test seams: actual TestClient/canonical schema, real isolated Supabase lot/
reservation/reversal fixtures, independently expected opening/closing and row balances,
cross-agency cursor rejection, M23-created credit integration; independent mutation
connections exercise availability under reserves. No live dms fixture writes.
