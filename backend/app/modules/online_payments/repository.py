"""SQL for online payments and their append-only provider events; never commits."""

from uuid import uuid4

from psycopg.types.json import Jsonb
from sqlalchemy import text

PAYMENT_SELECT = """
    SELECT p.*, a.code AS "agencyCode", a.name AS "agencyName", d.code AS "receiptCode"
    FROM dms.online_payment p
    JOIN dms.agency a ON a.id = p."agencyId"
    LEFT JOIN dms.document d ON d.id = p."receiptDocumentId"
"""
EVENT_SELECT = """
    SELECT p.*, origin."merchantReference" AS "sourceReference",
      origin.amount AS "sourceAmount", origin."providerTransactionId" AS "sourceTransaction",
      origin."paymentTime" AS "sourceTime"
    FROM dms.payment_event p JOIN dms.online_payment origin ON origin.id = p."paymentId"
"""


class OnlinePaymentRepository:
    def __init__(self, session):
        self.session = session

    def rows(self, sql, params):
        return [dict(row) for row in self.session.execute(text(sql), params).mappings().all()]

    def get(self, identifier, *, lock=False):
        """One payment with its agency/receipt labels, or None; lock takes the payment row."""
        rows = self.rows(
            PAYMENT_SELECT + " WHERE p.id = :id" + (" FOR UPDATE OF p" if lock else ""),
            {"id": identifier},
        )
        return rows[0] if rows else None

    def by_key(self, key):
        rows = self.rows(PAYMENT_SELECT + ' WHERE p."idempotencyKey" = :key', {"key": key})
        return rows[0] if rows else None

    def by_reference(self, provider, reference):
        return self.session.execute(
            text(
                "SELECT id FROM dms.online_payment "
                'WHERE provider = :provider AND "merchantReference" = :reference'
            ),
            {"provider": provider, "reference": reference},
        ).scalar_one_or_none()

    def agency(self, identifier, *, lock=False):
        rows = self.rows(
            "SELECT id, status, debt FROM dms.agency WHERE id = :id"
            + (" FOR UPDATE" if lock else ""),
            {"id": identifier},
        )
        return rows[0] if rows else None

    def create(self, agency, provider, amount, actor, key, expiry_seconds):
        """Insert a PENDING payment; None when another request already owns the key."""
        return self.session.execute(
            text("""
            INSERT INTO dms.online_payment ("agencyId", provider, amount, "createdBy",
              "idempotencyKey", "merchantReference", "expiresAt")
            VALUES (:agency, :provider, :amount, :actor, :key, :reference,
              dms.app_now() + make_interval(secs => :expiry))
            ON CONFLICT ("idempotencyKey") DO NOTHING
            RETURNING id
        """),
            {
                "agency": agency,
                "provider": provider,
                "amount": amount,
                "actor": actor,
                "key": key,
                "reference": "VNP" + uuid4().hex,
                "expiry": expiry_seconds,
            },
        ).scalar_one_or_none()

    def event(self, payment_id, event_key):
        rows = self.rows(
            'SELECT * FROM dms.payment_event WHERE "paymentId" = :payment AND "eventKey" = :key',
            {"payment": payment_id, "key": event_key},
        )
        return rows[0] if rows else None

    def append_event(self, identifier, evidence):
        self.session.execute(
            text("""
            INSERT INTO dms.payment_event ("paymentId", "eventKey", "providerStatus",
              "verifiedPayload")
            VALUES (:id, :key, :status, :payload)
        """),
            {
                "id": identifier,
                "key": evidence.eventKey,
                "status": evidence.status,
                "payload": Jsonb(evidence.model_dump(mode="json", exclude_unset=True)),
            },
        )

    def mark_success(self, identifier, transaction, payment_time, receipt):
        self.session.execute(
            text(
                "UPDATE dms.online_payment SET status = 'SUCCESS', "
                '"providerTransactionId" = :transaction, "paymentTime" = :time, '
                '"receiptDocumentId" = :receipt WHERE id = :id'
            ),
            {
                "transaction": transaction,
                "time": payment_time,
                "receipt": receipt,
                "id": identifier,
            },
        )

    def mark_unsuccessful(self, identifier, status, transaction):
        self.session.execute(
            text(
                "UPDATE dms.online_payment SET status = :status, "
                '"providerTransactionId" = coalesce(:transaction, "providerTransactionId") '
                "WHERE id = :id"
            ),
            {"status": status, "transaction": transaction, "id": identifier},
        )
