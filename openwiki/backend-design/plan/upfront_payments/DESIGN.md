# M19 design

UpfrontRepository owns table projections, immutable evidence lookup/insert/transition.
UpfrontPaymentService owns keyed verify/separate HTTP transactions and ETags. Typed
confirmation and separation result reuse existing PaymentReceipt and AgencyBalance.

All consumers serialize on agency balance, ordered documents/revisions, then evidence.
Issue post already holds rule/product/stock before financial locks. Verify/separate
must not acquire stock locks after agency/document locks. Recheck revision and grants
after waits. Shared evidence lookup lives in the owning module and does not commit.

Internal automatic receipt posting uses M16 within issue transaction; separation uses
M18's no-commit creation + M16 full-money replay. Set terminal evidence before forcing
constraints. Idempotent replay returns durable results only after current authorization.
Use timezone-aware Vietnam conversion without dependence on host local timezone.
