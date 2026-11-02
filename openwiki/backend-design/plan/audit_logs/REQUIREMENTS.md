# Requirements

BM14/QĐ14 and canonical AuditLog/AuditListResponse: USER/SYSTEM actor distinction,
nullable old/new data and request ID, current audit.read authorization. Filters:
actorId/actorType/functionCode/action/entityName/entityKey/requestId, createdFrom
inclusive, createdTo exclusive. Source TimeSort is id/-id/createdAt/-createdAt with ID
tie-breaker. BIGINT and domain numerics must never pass through float. Preserve
unrelated JSON notes/booleans/nulls and redact credentials defensively.
