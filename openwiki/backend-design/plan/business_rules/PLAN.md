# M10 business rules

**Current:** full local completion, D16 resolved; [evidence](VERIFICATION.md).

Prepared 2026-10-04 before code. M07/M08 prerequisites verified. Owns
getBusinessRules/updateBusinessRules. Sequence: settle D16 in canonical contract;
singleton read/ETag; locked update and blocker projection; authorized routes;
PG rollback/cap/rate/snapshot/race and exact scoped coverage verification.
