# M21 design and confirmed test seams

Feature owns schemas/repository/service/router/dependency. Reuse DocumentService,
InventoryRepository, CatalogueService pagination, TransactionRunner and exact values.
StockAdjustmentService composes no-commit create_internal/post_internal for counts.

Lock order: business rule → sorted products → sorted units → sorted stock balances →
document/current revision. Rediscover product IDs after document lock; restart on
changed dependencies. Authorize after command claim and every lock wait. Compare
complete detail ETag under lock. Append one POST batch, mark document/revision,
force deferred constraints before inventory projection and commit in owning command.
SQL validates every historical checkpoint; current stock bounds checked explicitly.
No financial replay or price-source write is needed.

Confirmed seams before tests: actual FastAPI/TestClient/source JSON schemas;
real service through Session; generated Supabase schema fixture; ordered_race uses
independent connections and observed blocking; fresh connections inspect persistence.
Inject failures at inventory append/finalization for audit/command/ledger rollback.
