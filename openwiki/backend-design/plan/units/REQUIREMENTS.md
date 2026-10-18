# Requirements — M09

| Requirement | Source | Acceptance |
| --- | --- | --- |
| N01 allowsFraction defaults false, strict JSON boolean | source Unit requests | valid defaults/toggle, no coerced string/number/null |
| N02 read any unit.manage/product.manage/inventory.read, write unit.manage | OpenAPI | each read alternative and live write recheck |
| N03 recorded meaning immutable | updateUnit; QĐ9 | any document/count line, including canceled history, blocks actual fraction change; same-value patch allowed |
| N04 INACTIVE blocks new goods use | QĐ9; guard_revision | existing products remain, new receipt/issue rejects inactive unit |
| N05 every reference blocks delete | source deleteUnit; FKs | product/document/count references and raced first use |
| N06 productCount server-derived, snapshots retained | source Unit | counts include inactive products, seed rename leaves history unchanged |
| N07 unique code/name/ETags/atomic audit | 0001; M02/QĐ14 | duplicates, stale/missing token, persisted rollback |

Initial SQL protects POSTED lines only for policy changes; API and additive 0005
enforce the broader source recorded-line/count interpretation while retaining
immutable initial DDL. Lock unit before quantity validation and coordinate with
receipt/issue posting SHARE locks; real race reproduction motivated 0005.
