# M29 test plan and symbol register

## Required behavior matrix

| Group | Success | Failure / boundary |
| --- | --- | --- |
| Goods replacement | Changed product/date/price/quantity; two successors; unchanged identity/order; old rows byte-equivalent; price source reselection | Earlier month goes negative despite positive current stock; removed-product history; duplicate/empty/zero/overflow; wrong kind/state; inactive historical source D15 |
| Goods cancel | DRAFT and POSTED; original-period reversal, surviving receipt source | Already canceled/stale/missing precondition; count-linked adjustment; price source removed/replaced; rollback after reversal/new revision/post |
| Cash/issue replay | Several later receipts reallocated FIFO; moved issue and auto date | Insufficient eligible manual debt; current limit/history/return-source conflict; special receipts protected |
| Upfront | Full VERIFIED/CONSUMED money separated once; excess credit and existing debt | Missing conditional permission fresh/replay; separation stage failure; immutable confirmation/origin |
| Returns | Fractional 1-VND cumulative increments; corrected earlier return revises later return | Over-cap/source price/date; zero-value stock; original posted rows unchanged; sold product removed |
| Credit/provenance | Multi-lot/invoice/reapplication/return preserves exact original cash | Reserved or paid source invalidation; two uses; no invented cash; valid protected source survives |
| Authorization/commands | Correction each allOf grant; cancel-only result without read grant; same-key retry | Each missing grant; revoke while waiting; changed payload; stale fresh key vs completed retry |
| Opposing races | Both lock winners: correction/cancel vs posting, return, receipt, credit, refund reservation, count | Exactly one valid outcome; no partial revision/audit/command/effect; dependency-set change retries |
| Period oracle | Independent SQL/reference aggregates before/after moved correction/cancel | Original period/restated date, actual return/refund date; totals independent of reversal visibility |

## Actual-symbol register

Current implemented goods symbols (module prefix `app.modules.document_corrections.goods`):

| Actual symbol | Success / failure / boundary evidence |
| --- | --- |
| `GoodsCorrectionService.__init__` | Both goods kinds in PG lifecycle; unsupported cash kind in offline schemas. |
| `.command` and its `authorize`, `work`, `project` closures | Both correction/cancel, kind/state/precondition/key guards, live allOf/cancel-only completed replay, observed grant revocation and changed-product rediscovery races. |
| `.replace` | Receipt/adjustment successor, changed/removed goods/date/price; duplicates, integer fraction, rounded zero, total overflow; inactive historic snapshots vs inactive new goods. |
| `.reverse` | Exact original date/order reversal; repeated successors and injected post-reverse rollback. |
| `.cancel` | DRAFT/POSTED for both kinds; canceled state/count link/history blockers; retained lines/revisions. |
| `.check_stock` | Positive current with negative past/removed goods rejected; zero stock allowed; stored overflow rejected. |
| `.correct`, `.cancel_document` | End-to-end persisted-state lifecycle, full payload retry and each failure above. |
| `stock_receipts.schemas.StockReceiptCorrection`, `stock_adjustments.schemas.StockAdjustmentCorrection` | Canonical-schema payload success; missing/blank/empty/extra field, zero/fraction precision/numeric JSON boundaries. |
| `0008_historical_receipt_corrections.upgrade`, `.downgrade` | Real 0007 inactive witness; fresh and populated upgrade, downgrade/re-upgrade preserves historical rows; first-post/new inactive goods still rejected. |
| `app.db.manifest.COMPATIBLE_HEAD` | 0008 isolated populated demo, repeated seed and 54 regression checks. |
| `manual_receipts.ManualReceiptCorrectionService.__init__`, `.run` and its `authorize`, `work`, `project` closures | Three-receipt FIFO restatement/date move, manual draft/posted cancellation; wrong kind/state/special receipt/acceptance date/overpay/current limit; stale ETag and same-key result. |
| `manual_receipts.ManualReceiptCorrectionService.reverse`, `.correct`, `.cancel` | Original financial reversals; injected failure after reverse/replay/projection restores source/revisions/ledgers/audit/command; observed competing post/one-key/grant-wait races. |
| `payment_receipts.schemas.PaymentReceiptCorrection` | Canonical manual methods/exact amount; reject ONLINE, identity/type override, missing amount, blank reason and numeric/precision/zero input. |
| Changed `settlement_core.service.WRITERS`; existing `.lock`, `.replay` behavior | documents.correct/post allOf; documents.cancel alone with actual live grants and replay, revoked grant after balance wait; actual return plus ACTIVE/CONSUMED refund sources;10retained M16 cases. |
| `issues.IssueCorrectionService.__init__`, `.evidence`, `.run` and authorization/work/projection closures | Zero-upfront correction/cancel; VERIFIED/CONSUMED cancellation and completed retry, conditional grant enforcement through final check; six-owner real HTTP lifecycle. Real competing issue/cash winners and one-key successor race. Dependency-rediscovery/full race matrix remains open. |
| `issues.IssueCorrectionService.lines`, `.replace` | Preserved recorded prices/rate, current source for new goods and explicit overrides; duplicate/fraction/unusable price/received-money floor; effective return date/source guards. Removed then retired product reintroduced using latest same-document POSTED snapshot. |
| `issues.IssueCorrectionService.reverse`, `.sync_auto`, `.separate_money`, `.check_stock`, `.correct`, `.cancel` | Original financial/inventory legs; auto-receipt dated successor; neutral DRAFT cancel; full40VND separation once. Injected replay failure and actual separate-connection grant revocation after separation both roll back all persisted effects. Historical stock rejection; stock-overflow boundary and full affected coverage remain open. |
| `returns.ReturnCorrectionService.__init__`, `.run`, `.prepare`, `.reverse`, `.replay_rounding`, `.check_stock`, `.correct`, `.cancel` | Fractional zero-value correction, later cumulative rounding successor and immutable original lines, cancel; over-cap and pre-sale date rejected. Six-owner HTTP grants/preconditions/replay; remaining failure/boundary/protection gates still open. |
| `credit.CreditCorrectionService.__init__`, `.run`, `.correct`, `.cancel` | FIFO correction and DRAFT/POSTED cancel, no new cash/inventory, replay rollback, state error, same-key replay; six-owner HTTP allOf/cancel-only/preconditions/payload conflict. Wider protected-source/race matrix remains open. |
| Changed `settlement_core.repository.SettlementRepository.lots`, `.available` | Three red-to-green realPG return-date moves (earlier/later/equal-day tie), current-revision FIFO/availability and byte-equivalent original lot provenance; retained reservation/paid refund and return/credit nodes. Exact whole-file coverage remains open. |
| Twelve owning correction/cancel handlers and schemas | Source canonical contract18offline tests; six realPG TestClient owner lifecycles, individual missing correction grants403, cancel-only with no read/post grants, missing428/422and stale412preconditions, completed retry and changed-payload409without effects, invalid media/JSON/extra fields/blank reason. VERIFIED/CONSUMED conditional cash fresh/replay tests. In-process HTTP is not deployed Docker evidence. |

Node IDs are the test functions under `tests/integration/document_corrections/`;
the XML selections in VERIFICATION preserve exact parameter IDs and all phases.
Existing M13/M14/M16 consumers retain owning registers; source/internal or in-process
HTTP evidence is not a published Docker operation. Manual-cash internal gates retain
their scope; added issue/upfront/return/credit evidence is recorded in VERIFICATION.
Full affected coverage, integrated/race/original-period and publication gates remain open.

## Commands and scope

From backend, use `uv run --frozen --no-sync` and explicitly set
`SUPABASE_TEST_SCHEMAS=1` before any integration command. The selected_database_factory
schema branch was inspected: only UUID schemas and separate metadata in current
Supabase; TestClient is in-process and its startup opens no HTTP port. Do not select
deployment or provider helpers that start separate runtimes. Do not fall back to
CREATE DATABASE mode. Keep XML/log/coverage evidence under existing data/backend.

First selection: `pytest tests/document_corrections tests/integration/document_corrections
-m 'not deployment' -q --tb=short`, with `--cov=app.modules.document_corrections
--cov-branch --cov-report=term-missing --cov-report=json:<artifact>` once code exists.
Add actual changed owner schema/service/router files to affected coverage scope.
Gate: exact 100% statements and branches per changed production file, zero excluded
or missing/partial lines; do not hide unfinished functions with pragmas. Add direct
schema witnesses for SQL changes, fresh/populated migration tests if needed. Required
skip/xfail/unrun cases keep gates open. Broaden retained tests only for affected paths.
