from sqlalchemy import BigInteger, Date, DateTime, Integer, Numeric, String, column, table

AGENCY = table(
    "agency",
    column("id", BigInteger),
    column("code", String),
    column("name", String),
    column("typeId", Integer),
    column("wardId", Integer),
    column("phone", String),
    column("address", String),
    column("email", String),
    column("acceptedDate", Date),
    column("debt", Numeric),
    column("status", String),
    column("terminatedAt", DateTime(timezone=True)),
    column("terminationReason", String),
    column("createdBy", BigInteger),
    column("updatedBy", BigInteger),
    column("createdAt", DateTime(timezone=True)),
    column("updatedAt", DateTime(timezone=True)),
    schema="dms",
)
