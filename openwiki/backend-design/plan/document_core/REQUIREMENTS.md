# M13 requirements

Authority: [target OpenAPI](../../API/openapi.json),
[selected Q01/Q03/Q05/Q14/Q15](../../../database-design/business_decision_making.md),
and immutable `backend/alembic/sql/0001_initial.sql` through0006.

| Requirement | Contract/schema rule |
| --- | --- |
| Identity | Generated code, creationKey, kind/agency/origin immutable; no physical delete |
| Ownership | Cross-parent revision/line lookup returns404; currentRevision composite FK |
| Revision | New revisions start DRAFT; revisionNo>1 requires reason; prior READY/POSTED unchanged |
| Lines | Four goods kinds only; one product/revision; quantity/unit policy; financial-only empty |
| Totals | HALF_UP whole VND per line, then sum; stored range validation; immediatePayment<=total |
| Snapshots | Historical names/contact/prices preserved; issue READY freeze remains M17 |
| Preconditions | Full parent content ETag; equal-total line changes still invalidate it |
| Neutral drafts | No inventory/receivable/credit entries or balance updates |
| Batches | POST/REVERSE/REALLOCATE append-only; unique post/revision and durable substep keys |
| Security | Current kind-specific read/prepare grants; actor/function/request audit context |

D16 positive stored-price seam is reused by issue consumers. D17 requires all-kind
read fixtures now; financial replay/publication remains owned by M16 and later.
