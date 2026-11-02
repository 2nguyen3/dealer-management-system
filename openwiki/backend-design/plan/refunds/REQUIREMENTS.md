# M27 requirements

Q08/Q09/Q10 require actual payout before debit/posting, actual Vietnam paid date, and
same-source cash conservation. One POSTED PAYMENT_RECEIPT determines agency/origin;
ONLINE requires the original successful payment. No arbitrary source/payment pairing.

Drafts stay neutral. Submit reserves full same-source availability and original cash
cap; DRAFT document/revision remains frozen while reserved/inflight. No invented READY.
Manual confirmation requires paidAt/evidenceReference; append evidence note, snapshot,
POSTbatch/debit/reservationCONSUMED atomically. Paid content is immutable.

Online TX1 reserves and persists PENDING attempt/internal key/initiating poster before
network. UNKNOWN keeps reserves; only definitive verifiedFAILED releases. Retry uses
new revision+reservation+attempt/key, preserving all old evidence; current availability
must still fit. No retry of PENDING/UNKNOWN/SUCCESS, no unpaid cancellation with those
attempts. Cancellation requires documents.cancel AND cash.refund.post after waits.

Canonical permissions/read scopes/ETags/headers/errors/12operations derive from API.
D07 accepted external sandbox remains unavailable; full-module/publication stays open.
