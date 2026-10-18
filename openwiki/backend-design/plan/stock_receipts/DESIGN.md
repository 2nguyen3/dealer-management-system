# M15 design

StockReceiptService composes DocumentService and InventoryRepository; HTTP router
delegates all business behavior. Reads select kind STOCK_RECEIPT and return exact
DocumentSummary or StockReceipt. List filters code/status/product/business dates
and literal q against code/note/snapshot names; scoped signed keysets include a
live anchor to reject changed sort boundaries.

Create/post use TransactionRunner and scoped command IDs; creationKey and batch
idempotency keys derive from command substeps. Payload includes validated body;
resource scope separates collection/create and per-document/post. If-Match is
checked on fresh work, not replay, allowing lost-response recovery.

## Posting lock protocol

Discover lines without locking parent; lock rule SHARE, unit/product SHARE sorted,
inventory balances UPDATE sorted, then document/revision UPDATE. Reload lines
and restart transaction if product set changed. This avoids parent→balance versus
balance→parent deadlocks with product policy and later inventory writers.
Recheck live post grant, kind/state/ETag and current master eligibility after waits.
Refresh draft snapshots before POSTED, set document status first for generated
businessOrder, then revision POSTED, create batch and append inventory entries.
Deferred SQL checks refresh price/stock; final projection returns inventoryChanges
with DerivedSellingPrice, full-resource ETag and validated mutation DTO before commit.

Header edits and internal draft cancel use caller-owned finalization; constraint
and commit failures roll back document/audit/commands. No provider/network work.
