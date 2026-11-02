"""Typed projections of reviewed SQL-owned tables, like the catalogue mappings.

DDL, generated columns, domains and triggers remain owned by Alembic SQL snapshots.
These mappings intentionally do not ask autogeneration to recreate those objects.
"""

from sqlalchemy import BigInteger, Date, DateTime, Integer, Numeric, Text, Uuid, column, table

DOCUMENT = table(
    "document",
    *(
        column(name, BigInteger)
        for name in (
            "id",
            "agencyId",
            "originDocumentId",
            "currentRevisionId",
            "businessOrder",
            "createdBy",
            "cancelledBy",
        )
    ),
    column("creationKey", Uuid),
    *(column(name, Text) for name in ("code", "kind", "receiptType", "status", "cancelReason")),
    *(column(name, DateTime(timezone=True)) for name in ("createdAt", "updatedAt", "cancelledAt")),
    schema="dms",
)
REVISION = table(
    "document_revision",
    *(
        column(name, BigInteger)
        for name in ("id", "documentId", "createdBy", "readyBy", "postedBy")
    ),
    column("revisionNo", Integer),
    column("businessDate", Date),
    *(
        column(name, Numeric)
        for name in ("totalAmount", "immediatePayment", "sellingPriceRate", "maxDebtSnapshot")
    ),
    *(
        column(name, Text)
        for name in (
            "state",
            "paymentMethod",
            "agencyName",
            "agencyAddress",
            "agencyPhone",
            "agencyEmail",
            "reason",
            "note",
        )
    ),
    *(
        column(name, DateTime(timezone=True))
        for name in ("createdAt", "updatedAt", "readyAt", "postedAt")
    ),
    schema="dms",
)
LINE = table(
    "document_line",
    *(column(name, BigInteger) for name in ("id", "revisionId", "productId", "originLineId")),
    column("lineNo", Integer),
    column("unitId", Integer),
    column("productName", Text),
    column("unitName", Text),
    *(
        column(name, Numeric)
        for name in ("quantity", "unitPrice", "basePurchasePrice", "returnAmount", "lineAmount")
    ),
    *(column(name, DateTime(timezone=True)) for name in ("createdAt", "updatedAt")),
    schema="dms",
)
BATCH = table(
    "posting_batch",
    *(column(name, BigInteger) for name in ("id", "revisionId", "createdBy")),
    column("kind", Text),
    column("idempotencyKey", Uuid),
    *(column(name, DateTime(timezone=True)) for name in ("createdAt", "updatedAt")),
    schema="dms",
)
