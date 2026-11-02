# M24 — agency credit reads

Prepared 2026-10-17 before code. Direct prerequisite M23 final verified core.
Own listAgencyCreditLots, getCreditLot, listAgencyCreditEntries. Reuse M20's
getAgencyBalance route; never register a second balance handler. Supply internal
AvailableCreditService for later mutation callers. No applications/refund/provider API.
Sequence: source-aware lots → reservation-aware pages → full atomic statement →
consumer availability seam → tests/review/deployment/handoff.

## Verified checkpoint2026-10-18

Three owned reads and shared availability pass8owning cases and exact6-file136/12
coverage. Source/configured Supabase0007, current/historical/reserved provenance and
direct/Nginx integration pass; [VERIFICATION](VERIFICATION.md). Next M25 owning plan.
