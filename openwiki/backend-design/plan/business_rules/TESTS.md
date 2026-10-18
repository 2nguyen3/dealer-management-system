# Actual symbols and gates

Scope app.modules.business_rules, 100% statement/branch coverage, plus changed
shared exact-value code. Required real PG and prerequisite regressions.

| Symbols | Success | Failure/boundary |
| --- | --- | --- |
| BusinessRuleRepository.get/lock/update/blockers | singleton/cap equal maximum | blocked district lists, empty DB usage |
| BusinessRuleService.get/etag/update | exact rate, persisted/audited change | stale ETag, rollback, cap below count |
| BusinessRuleUpdate/PatchModel; get_business_rule_service; both routes | source schema/policies/headers | empty/null/extra/float/rate precision, cap zero/max |

Independent connections: cap lowering vs last-slot agency admission, same-ETag
updates, rate change vs source-price receipt posting. Persist D16's 6e17×2 quote
and rounded zero, verify product reads and unchanged stored snapshots.

## Completed actual symbols → executed nodes

| Actual callable | Passing nodes |
| --- | --- |
| business_rules.repository.BusinessRuleRepository.__init__, get, lock, blockers, update | business_rules/test_rules.py::test_rules_contract_validation_state_rollback (empty/equal/blocked usage, exact fields, rollback); test_rules_same_etag_updates_have_one_winner |
| business_rules.service.BusinessRuleService.get, etag, update and update work closure | preceding nodes; master_data/test_races.py::test_last_slot_and_rule_lowering_both_orders; test_rate_change_vs_receipt_source_preserves_quotes; master_data/test_lock_authorization.py (rules) |
| dependencies.get_business_rule_service; router.get_business_rules, update_business_rules | exact full-operation contract/auth nodes; rules HTTP nodes; deployment/test_02_master_data_smoke.py |
| common.prices.stored_selling_price; common.schemas.numeric_alias(derived quote) | catalogues/test_prices.py::test_d16_readable_quotes_and_stored_price_boundary; shared_api/test_values.py::test_exact_numeric_contracts[DerivedSellingPrice]; master_data/test_state.py::test_product_unit_threshold_ranges_price_source_and_d16 |

BusinessRuleUpdate uses shared PatchModel.nonempty_patch and exact PriceRate;
BusinessRuleResponse and shared transaction symbols retain combined100% gates.
Final commands and scope: [VERIFICATION](VERIFICATION.md).
