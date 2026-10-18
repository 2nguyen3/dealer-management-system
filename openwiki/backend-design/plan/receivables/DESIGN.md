# M20 design

ReceivableRepository owns SQL snapshot projections; ReceivableService owns permission,
filter/cursor validation and typed pagination. Routes delegate without transaction writes.
Reuse shared AgencyBalance and InvoiceBalance DTOs and inventory ledger identity conventions.

Overview uses one SQL snapshot for filtered rows/totals/asOf, exact text in JSON numeric
fields. Invoice list includes only posted issues and current net outstanding. Ledger
window sums partition by agency and RANGE over date/order so charge + auto payment
share final balance. Date/source/target/kind/effective/cursor filtering happens after sums.
Allocation queries apply the same rule over the whole agency ledger, then select legs.

Prove whether historical balances can exceed stored Money; if reproduced, explicitly
resolve D14 in canonical OpenAPI to AggregateMoney without changing storage domains.
