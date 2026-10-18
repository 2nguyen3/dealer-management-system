# Design

FunctionRepository and PermissionRepository own joined SQL projections and group
existence checks. FunctionService/PermissionService reuse CatalogueService's exact
cursor anchors, filtering, transaction boundary and full-projection ETags.
PermissionService.set locks UserGroup FOR UPDATE before reading the pair, including
when no grant exists. This serializes creators and group deletion. Reauthorize
after waiting, compare precondition, flush, force deferred constraints, project,
commit. Function labels are immutable registry data. Repositories never commit.

Dependencies use make_service and request-scoped synchronous sessions. Routes use
BusinessRoute and require_permissions. No JWT grant snapshot or new cache.
