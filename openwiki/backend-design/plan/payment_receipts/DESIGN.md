# M18 design

PaymentReceiptService owns HTTP transactions and composes DocumentService and
SettlementService.post_receipt. Repository owns filtered document summary reads.
Internal receipt creation takes an already locked agency, explicit actor/command UUID,
type/method/date/amount and never commits; M19 reuses it for real received money.

Lock agency type/agency/balance before ordered agency documents/revisions; reauthorize
after waits. Validate kind/type/manual method/state/ETag before mutation. Replay and
forced deferred constraints precede refreshed AgencyBalance and mutation projection.
Standalone patches map amount to totalAmount and reject every special receipt type.
