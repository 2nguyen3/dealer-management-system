# Design — M08

AgencyType maps existing maxDebt as the money_vnd domain (Numeric), publicly exact Money.
AgencyTypeRepository.query returns master plus all/active counts in one query.
Lock type FOR UPDATE before affected agency_balance rows in agency ID order
(guard_rules/guard_ledger protocol). Inspect locked currentDebt for all attached
agencies; limit failure returns source-shaped safe agencyId/agencyCode/currentDebt,
never SQL or hashes. Recheck authorization after balance locks before mutation.
Share-lock type admission and FK serialize newly attached agencies against this
lock. No snapshots are modified and no caches are written directly.

AgencyTypeService inherits shared CatalogueService CRUD/pagination/transaction;
feature validate_update supplies limit policy. q/code/status and source id/name/
maxDebt sorts with id tie-breaker. Complete visible projection defines ETag.
Explicit routers enforce source permission alternatives, body and preconditions.
No type-specific migration; real issue-post/limit and assignment/limit races required.
Pagination uses shared anchor-v2 boundary digests and rejects moved/filter-mismatched
anchors rather than resuming from changed sort values.
