# Design

AgencyRepository projects agency_overview with exact string BIGINT actor/owner IDs.
Before all mutations: lock global rule FOR UPDATE, current type FOR SHARE,
current district FOR UPDATE, then agency FOR UPDATE and balance FOR UPDATE.
Destination masters are checked/locked in the same globally serialized transaction.
Global rule serialization prevents opposing-move deadlocks and cap races; type lock
precedes balance, matching existing limit/ledger guards. Re-read current row after
waiting; joined master locks stabilize full-response ETags. New master assignment
checks state, type limit and destination ACTIVE usage; existing inactive assignments
remain readable/editable. Repository validates earliest document revision date.

AgencyService uses CatalogueService writes; termination uses TransactionRunner /
CommandScope(actor,terminateAgency,agency-ID,key). Claim+termination+audit+typed
result commit atomically. Replay precedes obsolete ETag check but still authorizes.
TransactionRunner reauthorizes after claim resolution on both fresh and replay
paths. Create reauthorizes after rule/master waits and before insertion. 0006
revision INSERT/UPDATE locks its agency FOR SHARE, while acceptance edits hold
agency FOR UPDATE; an owner trigger also rejects dates after existing revisions.
Both independent date-race orders preserve the acceptance/history invariant.
Source snapshots and receivable caches remain unchanged by termination.
