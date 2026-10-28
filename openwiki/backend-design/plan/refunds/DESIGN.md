# M27 design

RefundService composes FinancialDocumentService, shared credit availability and
ReservationService in the caller's one transaction. Source receipt discovery precedes
agency type/agency/balance locks; agency documents/current revisions sorted byID,
lots then reservations/attempts. Reauthorize after claims/waits before state/ETag check.
Complete parent ETag already includes reservation and latest attempt projections.

Create derives agency, fixes source identity and validates date/method/current success
link. Update only unreserved/no-attempt currentDRAFT. Submit leaves DRAFT and reserves.
Manual confirm stores actual paidAt/evidenceReference in note and derives businessDate,
then snapshots/POSTbatch/POSTED/consume/replay and deferred checks before result/commit.
No external request occurs in manual transactions. Cancel validates both grants and
unresolved-attempt guard then releases active reservations before CANCELLED metadata.

Online request claims scoped command and persists identified initiating poster in
ACCEPTED recovery metadata with attemptId, then commits before provider I/O. Attempt
query/dispatch uses original payment and stable key. Completion locks whole source
closure, checks exactfullamount/reference and immutable terminal state, records payout
and consumes reservations. UNKNOWN does not release. FAILED→retry creates a new same-
content revision with explicit retry reason/reservations/attempt. Async postedBy comes
from durable initiating poster, never current poller or arbitrary preparer.

No speculative DDL; evaluate existing command recovery for durable attempt metadata.
All public routes remain unmounted until complete branch/acceptance evidence.

### Recovery and audit refinements

Original payment provider is bound to the configured adapter before new dispatch and
query. Same-command recovery queries first; only explicit verified absence may
redispatch the identical original merchant reference. Reconcile itself never dispatches
a transfer. Request transport uncertainty returns202UNKNOWN; reconcile translates
provider absence/unusable evidence to502 and unavailability to503, retaining reserves.
Terminal conflicting proof is409; exact terminal duplicates reuse stored evidence.

Reconcile commands remain ACCEPTED for PENDING/UNKNOWN and persist terminal responses
only after verified domain commit. `finish_provider_command` reauthorizes on both
sides of its command lock. Unknown commit replies recover by the same command key.
The immutable command.actor_id real FK is the posting-actor authority; the recovery
JSON actor field is diagnostic. UNKNOWN transport audit is SYSTEM with request
correlation; document cancellation audit uses documents.cancel while retaining both
required live grants. No new SQL revision is needed for these existing domain/command
storage seams; accepted-provider integration remains D07-blocked.
