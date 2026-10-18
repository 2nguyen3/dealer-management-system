# M12 agencies

**Current:** full local completion, M07/M08/M10 and shared D02 passed; [evidence](VERIFICATION.md).

Prepared 2026-10-04 before code. Dependencies M07/M08/M10. Shared D02 repair
reviewed in M11; agency HTTP does not introduce a product HTTP prerequisite.
Owns listAgencies/getAgency/createAgency/updateAgency/deleteAgency/terminateAgency.
Sequence: locked admission/profile reads/writes; permanent keyed termination;
contract/persisted/rollback/cap/type/history/races; exact coverage and regressions.
