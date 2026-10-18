# M13 tests and actual-symbol register

Confirmed user seams: shared service interfaces and HTTP contracts; PostgreSQL
persisted-state/rollback and independent connections are explicit verification seams.

Register actual implemented methods/validators here as they are introduced.
Required scope: `app.modules.document_core`, **100% statements and branches**,
combined with retained prerequisite suites. Required skips/xfails leave gates open.

| Interface responsibility | Success / failure / boundary |
| --- | --- |
| Exact projections | all7 seeded kinds; missing parent/revision/line404; large IDs/fractions/null snapshots |
| Creation/revision | deferred parent link; bad ownership/reason; empty draft/new revision |
| Draft lines | add/replace/delete; duplicate/wrong-kind/frozen403/409; same-total ETag/last line |
| Totals | per-line HALF_UP; overflow/immediate excess; smallest fractions/integer-unit rejection |
| Batch/reversal | append exact negatives; reverse reversal/already reversed denied; empty originals |
| Isolation | commit succeeds; forced rollback leaves no audit/command/ledger; two line writers one winner |

Tests live under `tests/document_core/` and `tests/integration/documents/`.
Exact test nodes and executed results are added to [VERIFICATION](VERIFICATION.md).

## Actual symbols — 2026-10-05

Prefix `tests/integration/documents/` below; offline values use `tests/document_core/`.

| Actual symbol | Passing test nodes (success/failure/boundary) |
| --- | --- |
| `DocumentRepository.__init__`, `DocumentService.__init__`, `create_draft` (both) | `test_core::test_empty_draft_identity_revision_and_balance_neutrality`, `test_missing_ownership_new_revision_and_kind_authorization`, `test_product_policy_checks_and_rollback_are_real` |
| `DocumentRepository.document`, `revision`, `lines` | `test_core::test_all_seeded_kinds_and_historical_revisions_have_exact_projections`, `test_missing_ownership_new_revision_and_kind_authorization`, `test_draft_lines_parent_etags_ownership_rounding_and_last_line` |
| `DocumentRepository.product_ids`, `lock_products`, `lock_current` | `test_product_policy_checks_and_rollback_are_real`, `test_financial_goods_immediate_and_dependency_guards`, `test_core_races::test_parent_serializes_line_numbers_and_etags_on_independent_connections` |
| `DocumentRepository.new_revision`, `DocumentService.new_revision` | `test_missing_ownership_new_revision_and_kind_authorization` |
| `DocumentRepository.put_line`, `remove_line`, `set_total` | `test_draft_lines_parent_etags_ownership_rounding_and_last_line`, `test_invalid_draft_line_leaves_document_unchanged`, `test_integer_unit_missing_line_revision_stale_etag_and_frozen_content` |
| `DocumentRepository.append_batch` | `test_append_only_batches_are_caller_owned_and_validate_kind` |
| `DocumentRepository.extras`, `DocumentService.get`, `get_revision`, `project_line`, `get_line`, `etag` | all-seeded-kind test; ownership test; line CRUD/guards test |
| `DocumentService.authorize_read` | ownership/kind-authorization test; all7 seeded kinds |
| `DocumentService.prepare_issue_line` | `test_provisional_issue_prices_require_a_source_and_storable_quote` |
| `DocumentService.draft`, `line_values`, `edit_line`, `create_line`, `replace_line`, `delete_line` | line CRUD, six invalid-line cases, financial/immediate/dependency guards, integer/frozen guards and real race |
| `exact_total`, `line_amount` | `tests/document_core/test_values::test_totals_use_per_line_whole_vnd_and_preserve_wide_precision`, invalid-line overflow cases |
| `batches.reversal_values` | `tests/document_core/test_values::test_reversal_preserves_source_and_exact_negative_value`; real ledger integration added in M14 |

No new validators are hidden outside this register; DTOs use previously verified
shared exact aliases. Core internal inputs are prepared by owning workflows;
public all-kind line dispatch still requires M28.

Final additions for `authorize_read`, `get`, `get_revision`: offline expiry/locked
error identity tests and real blocked reads in `test_read_session_races.py` preserve
401/Bearer and403 ACCOUNT_LOCKED. `test_core.py::test_all_line_mutations_reject_frozen_revisions_without_persisted_effects`
tests all3 mutations for both READY and POSTED, with unchanged persisted content/
totals/ledger. Final exact scope418 statements/100 branches. Authorized workflow
projection mode is exercised by internal cancel-only grants and public writes.
