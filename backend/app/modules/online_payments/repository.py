from uuid import uuid4

from sqlalchemy import text

from app.core.exceptions import ApiError

PAYMENT_SELECT = """
    SELECT p.*, (SELECT c.result->'body'->>'checkoutUrl'
      FROM dms.api_idempotency c WHERE c."operationId"='createOnlinePayment'
      AND c.result->'body'->>'id'=p.id::text LIMIT 1) AS "checkoutUrl"
    FROM dms.online_payment p
"""


class OnlinePaymentRepository:
    def __init__(self, session):
        self.session = session

    def get(self, identifier, *, lock=False):
        row = (
            self.session.execute(
                text(PAYMENT_SELECT + " WHERE p.id=:id" + (" FOR UPDATE OF p" if lock else "")),
                {"id": identifier},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Online payment not found")
        return dict(row)

    def reference(self, provider, reference):
        identifier = self.session.scalar(
            text(
                "SELECT id FROM dms.online_payment "
                'WHERE provider=:provider AND "merchantReference"=:reference'
            ),
            {"provider": provider, "reference": reference},
        )
        if identifier is None:
            raise ApiError(404, "NOT_FOUND", "Online payment not found")
        return identifier

    def create(self, agency, provider, amount, actor, key, expiry):
        return self.session.scalar(
            text("""
            INSERT INTO dms.online_payment ("agencyId",provider,amount,"createdBy",
              "idempotencyKey","merchantReference","expiresAt")
            VALUES (:agency,:provider,:amount,:actor,:key,:reference,
              clock_timestamp()+make_interval(secs=>:expiry)) RETURNING id
        """),
            {
                "agency": agency,
                "provider": provider,
                "amount": amount,
                "actor": actor,
                "key": key,
                "reference": ("VNP" if provider == "VNPAY" else "AGENTRA-PAY-") + uuid4().hex,
                "expiry": expiry,
            },
        )

    def event(self, payment_id, event_key):
        row = (
            self.session.execute(
                text(
                    'SELECT * FROM dms.payment_event WHERE "paymentId"=:payment AND "eventKey"=:key'
                ),
                {"payment": payment_id, "key": event_key},
            )
            .mappings()
            .one_or_none()
        )
        return None if row is None else dict(row)

    def append_event(self, identifier, evidence):
        from psycopg.types.json import Jsonb

        self.session.execute(
            text("""
            INSERT INTO dms.payment_event
              ("paymentId","eventKey","providerStatus","verifiedPayload")
            VALUES (:id,:key,:status,:payload)
        """),
            {
                "id": identifier,
                "key": evidence.eventKey,
                "status": evidence.status,
                "payload": Jsonb(evidence.model_dump(mode="json", exclude_unset=True)),
            },
        )
