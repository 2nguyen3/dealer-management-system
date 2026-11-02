from operator import ge, lt
from types import SimpleNamespace

from sqlalchemy import BigInteger, DateTime, Numeric, String, cast, column, select, table, text

from app.core.exceptions import ApiError
from app.modules.document_core.models import DOCUMENT, REVISION

UPFRONT = table(
    "upfront_confirmation",
    *(
        column(name, BigInteger)
        for name in ("id", "issueRevisionId", "verifiedBy", "receiptDocumentId")
    ),
    column("amount", Numeric),
    *(column(name, String) for name in ("method", "evidenceReference", "state")),
    *(
        column(name, DateTime(timezone=True))
        for name in ("receivedAt", "verifiedAt", "createdAt", "updatedAt")
    ),
    schema="dms",
)


class UpfrontRepository:
    model = SimpleNamespace(id=UPFRONT.c.id)
    columns = {
        **{
            name: cast(UPFRONT.c[name], String)
            if name in ("issueRevisionId", "verifiedBy", "receiptDocumentId")
            else UPFRONT.c[name]
            for name in UPFRONT.c.keys()
        },
        "issueDocumentId": cast(DOCUMENT.c.id, String),
        "agencyId": cast(DOCUMENT.c.agencyId, String),
    }
    ranges = {"createdFrom": (UPFRONT.c.createdAt, ge), "createdTo": (UPFRONT.c.createdAt, lt)}

    def __init__(self, session):
        self.session = session

    def query(self):
        return select(
            cast(UPFRONT.c.id, String).label("id"),
            *(value.label(name) for name, value in self.columns.items() if name != "id"),
        ).select_from(
            UPFRONT.join(REVISION, REVISION.c.id == UPFRONT.c.issueRevisionId).join(
                DOCUMENT, DOCUMENT.c.id == REVISION.c.documentId
            )
        )

    def source(self, revision_id):
        row = (
            self.session.execute(
                text("""
            SELECT d.id,d.kind,d."agencyId",d.status,d."currentRevisionId",
              r.state,r."immediatePayment"
            FROM dms.document d JOIN dms.document_revision r ON r."documentId"=d.id WHERE r.id=:id
        """),
                {"id": revision_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None or row["kind"] != "STOCK_ISSUE":
            raise ApiError(404, "NOT_FOUND", "Issue revision not found")
        return dict(row)

    def for_revision(self, revision_id, *, lock=False):
        query = 'SELECT * FROM dms.upfront_confirmation WHERE "issueRevisionId"=:id'
        if lock:
            query += " FOR UPDATE"
        row = self.session.execute(text(query), {"id": revision_id}).mappings().one_or_none()
        return None if row is None else dict(row)

    def insert(self, body, actor):
        return self.session.scalar(
            text("""
            INSERT INTO dms.upfront_confirmation
              ("issueRevisionId",amount,method,"receivedAt","verifiedBy","evidenceReference")
            VALUES (:revision,:amount,:method,:received,:actor,:reference) RETURNING id
        """),
            {
                "revision": int(body.issueRevisionId),
                "amount": body.amount,
                "method": body.method,
                "received": body.receivedAt,
                "actor": actor,
                "reference": body.evidenceReference,
            },
        )

    def finish(self, identifier, state, receipt_id):
        if state not in ("CONSUMED", "RECEIVED_SEPARATELY"):
            raise ValueError("Invalid upfront terminal state")
        self.session.execute(
            text("""
            UPDATE dms.upfront_confirmation SET state=:state,"receiptDocumentId"=:receipt
            WHERE id=:id
        """),
            {"state": state, "receipt": receipt_id, "id": identifier},
        )
