# M29 — Document corrections and owning-module completion

Prepared 2026-10-25 before implementation. Prerequisite: M28 published checkpoint.
Authority: [GENERAL_PLAN](../../GENERAL_PLAN.md), [E19](../full_backend/EXECUTION.md#5-where-to-spend-detailed-design-effort),
[canonical contract](../../API/openapi.json). Status2026-10-29: all twelve owning
operations published at0009; final M29/M30 runtime152business+2health. Service/financial/HTTP gates,
reviewed goods red/green regression,36normal-app source cases and3direct/proxy/public
deployment cases pass. Affected22files1124statements196branches exact100% per file;
M29-only aggregator64/0exact; final aggregator66/0exact separately in M30 evidence.
M29 is complete; full release gates remain separate.
Commands and protected live integrity are in [VERIFICATION](VERIFICATION.md).

## Scope and ownership

| Owning module | Correction operation | Complete cancellation operation |
| --- | --- | --- |
| stock_receipts | correctStockReceipt | cancelStockReceipt |
| stock_issues | correctStockIssue | cancelStockIssue |
| payment_receipts | correctPaymentReceipt | cancelPaymentReceipt |
| stock_adjustments | correctStockAdjustment | cancelStockAdjustment |
| sales_returns | correctSalesReturn | cancelSalesReturn |
| credit_applications | correctCreditApplication | cancelCreditApplication |

These are the twelve existing IDs in OPERATIONS, not new generic HTTP resources.
Request/response/header/status definitions remain solely in OpenAPI. Correction
creates a POSTED successor (201 + revision Location); cancel retains all history.

## Execution slices

1. Goods: receipt and independent adjustment full replacement/cancel; original
   effective date/order reversals, historical nonnegative stock, current price source.
2. Zero-upfront issue and manual cash: reverse original financial legs, replace or
   cancel source, run M16 chronological replay; reject genuine overpay/limit conflicts.
3. Upfront: immutable full received money, auto-receipt successor synchronization,
   cancellation into a separate RECEIVED_UNAPPLIED receipt; conditional authorization.
4. Returns: preserve origin line/price, cap, cumulative rounding and immutable later
   successors using M23; do not manufacture a new actual return for a correction.
5. Credit: application replacement/cancel and repeated-return cash provenance.
6. Dependency guards: ACTIVE/consumed reservation, paid refund, online/special cash
   receipt, confirmed count; all injected rollback stages.
7. Opposing races and independent original-period ledger oracle; owner regression,
   exact coverage, source/runtime contract and allowed deployment evidence.

Finish a tested vertical slice before broadening. Keep partial services internal;
publish an operation only after every promised branch and its required gates pass.
M30 follows the completed M29 dependency, then M31/D09 and M32/D10 decisions.

## Allowed environment

Use current Supabase DB_* only, generated UUID domain/metadata schemas with explicit
SUPABASE_TEST_SCHEMAS=1. TestClient runs in-process; no app/mail/provider HTTP server,
new database/container/service/Compose project/tunnel. Existing dms backend/frontend
at 8000/8080 and ngrok upstream remain intact. Test fixtures never touch live dms
documents, particularly payment37/receipt774. No reset/seed or snapshot modification.

## Exit

All twelve full operations, actual-symbol success/failure/boundary, persisted state,
rollback and relevant independent-connection races; exact per-file 100% statements/
branches in changed production scope; retained affected consumers and original-period
oracle. Update six owners, GENERAL_CHECKLIST, availability and GOAL with actual evidence.
Required unrun gates, D15 migration witnesses and external refund settlement stay open.
