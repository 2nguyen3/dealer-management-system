# M25 design

CreditApplicationService extends FinancialDocumentService; CreditApplicationRepository
specializes FinancialDocumentRepository by kind. Reuse DocumentService for detail, full
aggregate ETags and neutral creation; AvailableCreditService for writer-locked current
availability; SettlementService.replay is the authoritative historical planner.

Lock sequence: scoped durable command claim → agency type SHARE → agency SHARE →
agency balance UPDATE → all agency documents/current revisions by ID → credit lots by
ID → current document/revision reload. These match M16 reservation/application locks.
Reauthorize after waits and compare complete parent detail only under these locks.

Post sets the current revision POSTED with actor/time and agency snapshots, sets document
POSTED, appends a POST batch, then runs complete chronological replay. Replay produces
OFFSET/CREDIT legs atomically, protects reserved/paid provenance and enforces final
limits. TransactionRunner forces deferred constraints, projects and validates the
response/command result, commits once and returns success. Errors roll back all rows.
No provider call, receipt creation or balance-cache write is part of this workflow.

Date updates cannot precede agency acceptance. Agency is immutable. Draft cancellation
records reason/actor/time without financial effects and remains internal until M29.
Current availability is informative: historical eligibility is decided by replay,
not by incorrectly rejecting a backdated valid application against today's balance.
