# M09 — units

Prepared 2026-10-04 **before implementation**. Prerequisite: verified M02.
Own listUnits/getUnit/createUnit/updateUnit/deleteUnit. Authority: OpenAPI Units,
BM9/QĐ2/QĐ7/QĐ9/QĐ14, 0001 unit/product/document_line/stock_count_line and M09.

Phases: strict fraction/master models; existing-table mapping/repository historical
references; shared catalogue CRUD with explicit unit policy and five HTTP handlers;
offline and PG contract/state/rollback/seed/history/concurrency; 100% scope; evidence.
Resolve recorded-use interpretation conservatively: document lines including
draft/canceled history and count observations freeze fraction meaning.
