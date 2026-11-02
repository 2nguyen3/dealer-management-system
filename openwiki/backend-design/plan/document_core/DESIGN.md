# M13 design

`app/modules/document_core/` owns schemas, SQL projections, repository and service.
Core TableClause mappings preserve SQL-managed domains/generated columns/FKs;
Alembic imports them without making autogeneration recreate the reviewed schema.

## Interfaces

- DocumentRepository: document/revision/line lookup, creation and new revision,
  ordered product discovery, line writes/totals and append batch.
- DocumentService: exact detail/revision/line/summary/mutation projections, parent
  ETag, kind authorization, current-DRAFT guard and draft line operations.
- Batch primitives validate kind and reverse effective originals only; actual
  ledgers are owned by inventory/settlement callers.

## Transaction and locks

Services providing shared primitives never commit. Owning workflow sets audit
context, claims command, discovers product set, locks rule SHARE, then products
sorted and their units sorted, inventory balances if posting, then parent/revision.
After lock waits reload state, current grants and ETag. Changed discovered line
set causes a full-transaction retry, not acquiring lower-order locks afterward.
Line policy triggers `a0_product_policy` then `a0_unit_policy` take product/unit
SHARE before `a_guard` revision UPDATE; application
pre-acquisition follows that order. Parent serializes lineNo and duplicate checks.
Agency revision trigger takes agency SHARE; financial callers must prelock agency.

Creation inserts document then DRAFT revision then links currentRevision inside
the deferred composite FK transaction. Draft edits recalculate total before final
constraints; last-line deletion requires immediatePayment=0. Validate numeric
overflow before writes. Force constraints and validate DTO before caller commits.

Readers use stored revision snapshots. Any-of dispatch retries only403 FORBIDDEN;
session/account errors propagate. Authorized write projections may explicitly
disable the extra read-grant check, preserving source cancel-only authorization.
All-kind extras derive from immutable
ledger sums and recorded evidence, never placeholders. Multi-query detail reads
hold parent SHARE so application child writers cannot produce mixed revisions.
