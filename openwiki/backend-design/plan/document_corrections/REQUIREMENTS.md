# M29 requirements and traceability

| ID | Source | Required behavior |
| --- | --- | --- |
| C01 | OpenAPI twelve IDs in PLAN; Q04/Q13 | Stable document/code/agency/origin/businessOrder; append revision, never rewrite frozen content; correction restores original business truth, actual return/refund uses its own workflow. |
| C02 | OpenAPI correction schemas | Complete replacement, nonblank reason, exact bounded stored money/quantity; no client-written caches, totals or balances. |
| C03 | OpenAPI x-permissions; D03/D13 | documents.correct AND respective post/apply; documents.cancel for cancel; conditional cash.receipt.post on issue separation. Reauthorize after lock/command waits and completed retries. Complete parent ETag; same key/payload returns committed result, changed payload conflicts. |
| C04 | Q04; assert_product | Reverse at each original entry's date/order/identity; replacement at corrected date with original order; reject any negative historical stock and current overflow; select latest effective receipt purchase price, never adjustment price. |
| C05 | Q05/Q10; D06/D08/D17 | Replay full same-agency financial closure including later manual/online/auto/separate receipts, returns, applications, paid refunds and reservations; maintain FIFO, source cash and current debt limit. |
| C06 | OpenAPI correctStockIssue | Keep actual immediatePayment; omitted purchase/rate snapshots retain originals; explicit corrected snapshots must be valid. Preserve agency snapshot; sync auto-receipt date with a new version, never mutate POSTED. |
| C07 | OpenAPI cancelStockIssue | No effective return may survive cancellation; independent manual cash must still fit eligible debt; separate VERIFIED/CONSUMED full upfront money into RECEIVED_UNAPPLIED with debt FIFO/excess credit atomically. |
| C08 | OpenAPI manual cash operations | Only manual DEBT_COLLECTION CASH/BANK_TRANSFER eligible; ONLINE/AUTO_FROM_ISSUE/RECEIVED_UNAPPLIED remain protected. Never cancel receipt774 or use correction as refund. |
| C09 | Q13/Q14; M23/0007 | Preserve original return line and price, sold quantity cap and HALF_UP cumulative rounding incl. zero increments; dependent posted lines use immutable successors. |
| C10 | Q14/Q15; M16/M25/M27 | Credit application creates zero new cash; preserve exact original receipt across application/return chains. Cannot erase paid refund or spend ACTIVE reservation, nor invalidate protected source. |
| C11 | M22/guard_document | Confirmed-count-linked adjustments cannot be corrected/cancelled; independent adjustment keeps stock-only zero total/price. |
| C12 | TransactionRunner; M13/M16 | One caller-owned transaction for revision, reverse/post/reallocate, audit and command result; immediate constraints and typed response before commit; all failures rollback. |
| C13 | D15 | Reproduce inactive-master/terminated-agency historical correction under current SQL before choosing additive migration. Distinguish existing historical goods from newly introduced inactive goods; retain original snapshots. |
| C14 | D14/D16; M30 handoff | Independent period oracle attributes corrections to original/corrected effective dates, actual returns/refunds to their event dates; exact aggregate arithmetic and readable derived selling prices. |

Source precedence: selected database business decisions and canonical API, reviewed
SQL constraints, owning verified services. A discovered conflict is evidence to
resolve, never permission to suppress a failing test or bypass a trigger. Deployed
0001–0007 remain immutable; allocate a new revision only after a concrete witness.
