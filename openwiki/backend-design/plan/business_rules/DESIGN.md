# Design

BusinessRuleRepository owns SQL singleton read/lock/update and grouped active
district blocker query. BusinessRuleService uses CatalogueService.write for audit,
current authorization, flush/deferred constraints/commit/rollback. Lock singleton
FOR UPDATE before counting agencies, compare full response ETag, reauthorize after
waiting. Agency writers lock the same singleton first. ETag hashes timestamps,
cap and rate, without exposing the boolean storage key.

D16 uses existing exact numeric infrastructure with a named unbounded derived
integer alias. PostgreSQL round semantics and Decimal ROUND_HALF_UP agree. Quote
sorting stays numeric. Contract update precedes price API publication.
