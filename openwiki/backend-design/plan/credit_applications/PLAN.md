# M25 — credit applications core

Completion2026-10-29: [M29 full posted correction/cancel](../document_corrections/VERIFICATION.md)
is published, preserving same-agency provenance/reservations, exact amount and zero
new cash. Original core scope below is historical; the owning operation inventory
is complete while whole R5/R6 remains separate.

Prepared 2026-10-22 before implementation. Prerequisite: M24's verified available-credit
reader and M16's seven-kind chronological settlement replay. Canonical contract:
`../../API/openapi.json`; owning work package:
`../full_backend/MODULES.md#m25--credit_applications-core`.

Deliver listCreditApplications, getCreditApplication, createCreditApplication,
updateCreditApplicationDraft and postCreditApplication. Implement internal
cancel_draft; public cancelCreditApplication and correctCreditApplication remain M29.

Sequence: strict financial request schemas; shared financial-service composition;
neutral drafts/header updates; atomic post/replay; HTTP binding; offline contract
tests; isolated Supabase persisted/rollback/race tests; coverage and review.
No schema change is planned: existing immutable credit/receivable legs preserve
cash provenance via M16's ordered pairing. Any defect requires reproduction first.

Publication requires complete operation behavior and passing owning/regression gates.
Planning or mounted test probes do not constitute verified publication.
