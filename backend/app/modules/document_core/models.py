"""Typed projections of the SQL-owned 0011 tables used by document services.

DDL, generated columns, domains and triggers remain owned by the Alembic SQL snapshot;
these lightweight tables are not part of autogeneration metadata.
"""

from sqlalchemy import BigInteger, Date, DateTime, Integer, Numeric, Text, column, table

DOCUMENT = table(
    "document",
    *(
        column(name, BigInteger)
        for name in (
            "id",
            "agencyId",
            "replacesDocumentId",
            "createdBy",
            "postedBy",
            "cancelledBy",
        )
    ),
    *(
        column(name, Text)
        for name in ("code", "kind", "receiptType", "status", "note", "cancelReason")
    ),
    column("businessDate", Date),
    column("totalAmount", Numeric),
    column("sellingPriceRate", Numeric),
    *(
        column(name, DateTime(timezone=True))
        for name in ("createdAt", "updatedAt", "postedAt", "cancelledAt")
    ),
    schema="dms",
)
LINE = table(
    "document_line",
    *(column(name, BigInteger) for name in ("id", "documentId", "productId")),
    column("lineNo", Integer),
    column("unitId", Integer),
    column("productName", Text),
    column("unitName", Text),
    *(column(name, Numeric) for name in ("quantity", "unitPrice", "lineAmount")),
    *(column(name, DateTime(timezone=True)) for name in ("createdAt", "updatedAt")),
    schema="dms",
)
AGENCY = table(
    "agency",
    column("id", BigInteger),
    column("typeId", Integer),
    *(column(name, Text) for name in ("code", "name", "status")),
    column("debt", Numeric),
    column("acceptedDate", Date),
    schema="dms",
)
PRODUCT = table(
    "product",
    column("id", BigInteger),
    column("unitId", Integer),
    *(column(name, Text) for name in ("code", "name", "status")),
    column("stock", Numeric),
    column("lastPurchasePrice", Numeric),
    schema="dms",
)
APP_USER = table("app_user", column("id", BigInteger), column("fullName", Text), schema="dms")
