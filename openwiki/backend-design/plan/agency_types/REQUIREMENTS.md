# Requirements — M08

| Requirement | Source | Acceptance |
| --- | --- | --- |
| T01 exact Money maxDebt, zero valid | OpenAPI; money_vnd | strings only, integer/range/precision; no rounding |
| T02 any agency_type.manage/agency.read/agency.manage reads; agency_type.manage writes | OpenAPI | live grants, no management bypass |
| T03 debt of every attached agency bounds limit | QĐ3/QĐ7; guard_rules/ledger | equality passes, one VND over fails, safe blockingAgencies including TERMINATED |
| T04 inactive type cannot be newly assigned | QĐ8; guard_agency | concurrent move/creation serialized with limit/state update |
| T05 any reference blocks deletion | FK; deleteAgencyType | terminated reference and raced assignment protected |
| T06 count all and active separately; no snapshot rewrite | source AgencyType | seeded counts/historical snapshots unchanged |
| T07 Master uniqueness/ETags/audit | 0001; M02/QĐ14 | duplicate 409, stale 412, rollback/commit evidence |
