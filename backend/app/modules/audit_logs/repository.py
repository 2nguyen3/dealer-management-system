from operator import ge, lt
from types import SimpleNamespace

from sqlalchemy import BigInteger, DateTime, String, cast, column, select, table
from sqlalchemy.dialects.postgresql import JSONB

from app.common.catalogue import CatalogueRepository

AUDIT = table(
    "audit_log",
    column("id", BigInteger),
    column("actorId", BigInteger),
    *(
        column(name, String)
        for name in ("actorType", "functionCode", "action", "entityName", "entityKey", "requestId")
    ),
    column("oldData", JSONB),
    column("newData", JSONB),
    column("createdAt", DateTime(timezone=True)),
    column("updatedAt", DateTime(timezone=True)),
    schema="dms",
)


class AuditRepository(CatalogueRepository):
    model = SimpleNamespace(id=AUDIT.c.id)
    columns = dict(AUDIT.c.items())
    ranges = {"createdFrom": (AUDIT.c.createdAt, ge), "createdTo": (AUDIT.c.createdAt, lt)}

    def query(self):
        return select(
            *(
                cast(col, String).label(name)
                if name in {"id", "actorId", "oldData", "newData"}
                else col
                for name, col in self.columns.items()
            )
        )
