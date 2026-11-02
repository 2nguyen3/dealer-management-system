# M26 checklist

## VNPAY preparation — 2026-10-25

- [x] User selected VNPAY sandbox; merchant registration reported complete.
- [x] Native settings and main `.env` configuration verified; separate VNPAY env file removed.
- [x] New settings symbols have passing success/failure/boundary and redaction tests.
- [x] Native checkout/IPN/Return/query/refund mapping implemented and verified.
- [x] Accepted VNPAY checkout/automatic IPN/query/refund request+pending-query evidence obtained; canonical packet published.
- [ ] Observe external terminal bank refund settlement; current verified state is PENDING, not paid.

- [x] Prepare six-file owning design before code; record D07 environment blocker.
- [x] Evaluate/reproduce recovery needs: existing ACCEPTED/COMPLETED command storage supports durable checkout; no new SQL revision required.
- [x] Implement/register strict typed HTTP adapter, HMAC and six canonical operations in the isolated composition.
- [x] All16owningPG cases prove TX1/TX2, real HTTP lost replies/restart, full money, both race winners and rollback.
- [x] Exact per-file531statements/126branches, affected shared coverage, regressions and separate standards/specification reviews pass.
- [x] Retained fresh/populated migration/seed/integrity and controlled image/direct/Nginx probes pass at0007.
- [x] Accepted deployed VNPAY merchant/callback/protocol verification passes; pending bank refund is recorded separately above.
- [x] Publish six complete operations and update operation-specific frontend handoff with evidence.
