# Requirements — M07

| Requirement | Source | Acceptance |
| --- | --- | --- |
| D01 source Master requests, integer catalogue IDs | OpenAPI | nonempty patch, no null/extra; exact status/headers/errors |
| D02 any district.manage/agency.read/agency.manage reads; district.manage writes | OpenAPI | each grant alone reads; missing/false denies; live write recheck |
| D03 global capacity/count/remaining slots | QĐ1/QĐ7; business_rule | excludes TERMINATED; full/empty/inactive; rule change alters ETag |
| D04 INACTIVE preserves existing agencies | source updateDistrict; guard_agency | existing active references survive; new active admission/move fails |
| D05 any agency blocks deletion | FK; source deleteDistrict | ACTIVE/TERMINATED references, raced assignment protected |
| D06 unique code/name; ETags/audit/atomicity | 0001; M02; QĐ14 | duplicate 409, stale 412, persisted rollback, safe audit |

Counts are not editable. Capacity is global max minus active count; inactive status
does not manufacture a new cap. Existing seed/history must remain unchanged.
