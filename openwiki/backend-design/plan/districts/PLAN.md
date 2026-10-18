# M07 — districts

Prepared 2026-10-04 **before implementation**. Prerequisite: verified M02.
Own listDistricts/getDistrict/createDistrict/updateDistrict/deleteDistrict, all
source branches. Authority: OpenAPI Districts, BM1/QĐ1/QĐ7/QĐ14, 0001 district,
business_rule/agency and General Plan M07. No per-district cap column.

Phases: strict master models/projection; repository and global-rule-before-district
locking; shared catalogue transaction/pagination infrastructure; five HTTP routes;
offline and real-PG contract/state/rollback/seed/race tests; 100% scoped coverage;
evidence and availability. See the five companions in this folder.
