# M17 design

StockIssueService composes DocumentService, InventoryRepository and SettlementService.
Owned DTOs accept server-priced lines only. Repository owns kind-filtered summaries,
agency joins, invoice balance filters, SQL stock history checks and issue mutations.

Lock order: rule → ordered products/units → ordered stock balances → agency type/
agency/balance → ordered agency documents/revisions → evidence. Discover dependencies
first; reload after lock and retry if changed. Recheck live authorization after waits.
Create/update/submit use the same agency balance lock as financial writers. Posting
records stock and one POST batch, then settlement replay before final constraints.
Automatic receipt composition is added by M19 within this same transaction.

Use TransactionRunner for command identity/retry. Header writes retain explicit commit.
ETag is the complete detail projection; final response is validated before commit.
No generic line/history/cancel endpoint is mounted while M28/M29 branches are deferred.
