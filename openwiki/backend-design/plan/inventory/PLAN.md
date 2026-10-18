# M14 — Inventory

Prepared 2026-10-05 before code. Prerequisite M13; packet E08 first slice.

Implement full `listProductInventoryEntries` at
`GET /products/{productId}/inventory-entries`, plus reusable ordered stock locking,
append and reversal helpers. Product overview remains M11-owned.

Phases: exact ledger schemas → one-snapshot statement query → scoped keysets and
HTTP authorization → writer integration with M15 → real history/race verification.
All persisted goods kinds and reversals must be readable before publication.

See [requirements](REQUIREMENTS.md), [design](DESIGN.md), [tests](TESTS.md),
[checklist](CHECKLIST.md), [evidence](VERIFICATION.md).
