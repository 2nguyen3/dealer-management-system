# M27 verification

## Native VNPAY and current publication — 2026-10-25

All12operations are mounted with complete manual/online code branches. Owning scope
517statements/100branches is exact per-file100%;11owning PG cases and2native shared
payment/refund cases pass complete phases in Supabase UUID schemas. Native assertions
prove UNKNOWN retention, source-bound success/duplicate and signed09FAILED release.
FAILED completedAt uses signed PayDate or verified-rejection observation time; no
payout date is invented. Shared adapter symbols are registered in M26 TESTS.

Actual external request/query accepted refund15714325/5000VND as05/PENDING with
matching signature/source identity/amount/OrderInfo. External terminal bank settlement
remains open; this is not an external paid payout. Current full offline568passes;
declared packet/config/API1783/408exact100% and6unique deployment cases pass. Exact
commands/artifacts/40unique PG accounting and normal dev receipt774 are in
[M26 evidence](../online_payments/VERIFICATION.md). Earlier unmounted statements below
are historical, not current availability.

Owning plan prepared before code. No M27 implementation/test/publication claim yet.
M26 remains unmounted/incomplete; accepted external sandbox unavailable (D07 user
confirmed). Internal manual work can proceed using existing M16 reservation primitives;
whole-operation/publication/fullmodule gates remain open until online evidence passes.

## Resumed engineering checkpoint

Internal manual and online services and all12route definitions now exist; **unmounted**.
Offline canonical12operations pass. M27 pure/schema/adapter2cases also pass. No100%
claim: owned service/online/reads/routes branches remain under verification.

Passing completePG checkpoints in approved temporary directory:
- agentra-resumed-refunds:2nodes(manualpaidactualVietnamdate,onlineUNKNOWN/querysinglepost).
- agentra-m27-guards:3nodes(both manualconfirm/cancel lockwinners,oneovercredit and
  mid-consume rollback with independent persistedstate checks).
- agentra-m27-retry:1node(failed payout releases; actualM25spends source credit;
  retry fails/rollsback newrevision; actualreturn restores originalsource; freshretry
  revision/reservations/attempt succeeds without reactivating oldevidence).
- agentra-m27-http:1node(actualmanual12route subset/filter/ETag/evidence guards).
- agentra-m27-auth:1node(completeAuthService/grant revoked during observed balancewait).

The pre-interruption agentra-m27-online worker suffered a Windows accessviolation
after its call; its incomplete teardown is NOT passing evidence. Resumed worker above
passed setup/call/teardown and supersedes it. Sourcebound/providerbinding/terminalproof
review fixes continue with explicit tests. D07externalacceptance still unavailable.

Standards review identified recovery-before-dispatch, originalprovider binding and
conflictingterminalproof gaps. Implemented same-reference recovery only after
authoritativeprovider404 on a same-command replay; normalreconcile never initiates
a transfer. Productiondependency binds original provider to configuredadapter.
Exactduplicate terminalproof returns stored outcome; conflictingproof409.

## 2026-10-24 final engineering verification in progress

agentra-release-m27 passed11/11current PostgreSQL nodes with complete setup/call/teardown:
live post-grant wait, each missing cancel grant on completed replay, both manual
confirm/cancel winners, both actual M25application/M27submit winners, mid-post rollback,
actual manual HTTP/evidence/cursor paths, manual Vietnam paid-date and online recovery/
retry. Remaining targeted amount-error/unsupported-manual-dispatch boundaries are
checkpointing in agentra-m27-last-boundaries; exact owning coverage is being rechecked.

The controlled built-image direct/Nginx probe passed both flows in
agentra-packet-deployment-results. It exposed an actual UNKNOWN completion-time
serialization defect before passing: private normalized UNKNOWN refund evidence now
has nullable completedAt, still requiring time/provider identity on terminal success.
No real provider credentials or externally accepted environment was used.

Final reconciliation uses ACCEPTED metadata until terminal proof, then saves actual
typed results through finish_provider_command; completed replay reauthorizes and
returns the committed result. A different poller preserves command.actor_id FK as
postedBy. Cancellation audit is documents.cancel and UNKNOWN transport audit has
SYSTEM/request correlation. DefiniteTX1 retries are bounded; ambiguous replies retain
the same intent. D07 external acceptance/publication gates remain open.

Current owning coverage combination:all8files514statements/100branches, individually
zero missing/excluded lines and missing/partial branches. agentra-m27-last-boundaries
passed its2targeted nodes, adding the unpaid manual-method rejection and malformed
full-amount provider-response202UNKNOWN path with reservations retained until verified
definitive failure. The11unique owningPG IDs remain11 (rerun nodes counted once).
Additional pure boundary tests and canonical schema checks run in the full offline
selection. No full-module/publication closure is claimed while D07 is unavailable.
