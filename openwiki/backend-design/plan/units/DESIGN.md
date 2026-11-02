# Design — M09

Unit maps existing allowsFraction Boolean. UnitRepository.query projects current
productCount; lock unit FOR UPDATE. references checks product, document_line and
stock_count_line explicitly. validate_update compares actual old/new fraction and
rejects any recorded line/count reference with safe MASTER_CONFLICT. This includes
drafts and canceled recorded history, stricter than initial POSTED-only guard and
matching source language. No-op fraction patches remain valid.

UnitService inherits shared catalogue CRUD/transaction/anchor-pagination. q/code/
status/allowsFraction and catalogue sorts use literal bound search and id tie-breaker.
ETag covers full visible resource. Writes audit under unit.manage, force deferred
constraints and commit; rollback all failures. Existing FKs and posting unit SHARE
locks coordinate deletion/first-use and policy changes. Initial plan expected no
migration; the reproduced race below required additive revision 0005.
Five explicit handlers/dependency follow BusinessRoute and exact source contract.

## Race finding and reviewed additive repair (before migration code)

2026-10-04 real two-connection policy-first insertion reproduced stale fraction
validation: guard_line reads the old unit before its FK waits on the policy writer.
Add revision 0005: an alphabetically earlier BEFORE line/count INSERT/UPDATE trigger
takes unit FOR SHARE **before** existing validators; a unit BEFORE UPDATE guard
freezes any document/count recorded meaning. Preserve all original triggers and
snapshots. PostgreSQL re-evaluates the unit after the lock wait. Test both winners,
fresh/populated upgrade, downgrade/reupgrade and seed/regression compatibility.
