"""VNPAY online payments on the simplified model (handoff 3.3).

A checkout never exceeds the agency's current debt (QĐ4; the ``guard_payment``
trigger enforces it again). A verified success (IPN or reconcile) appends the
provider event, posts one ONLINE payment receipt through ``DocumentService`` and
marks the payment SUCCESS in one transaction. Duplicates are absorbed by the locked
payment row, ``UNIQUE(paymentId, eventKey)`` and ``UNIQUE(provider,
providerTransactionId)``; there is no command table. Network calls never run inside
a database transaction.
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.common.dates import vietnam_date
from app.common.pagination import build_page
from app.core.exceptions import ApiError, AuthError
from app.core.request_context import set_audit_context
from app.core.transactions import translate_database_error
from app.modules.document_core.service import DocumentService
from app.modules.online_payments.repository import (
    EVENT_SELECT,
    PAYMENT_SELECT,
    OnlinePaymentRepository,
)
from app.modules.online_payments.schemas import (
    OnlinePayment,
    OnlinePaymentList,
    PaymentEvent,
    PaymentEventList,
)
from app.modules.online_payments.vnpay import PROVIDER, amount_to_vnpay

READ = ("payments.online", "debt.read")
WRITE = ("payments.online",)
CONFLICTS = {
    ("23514", "ck_online_payment_debt"): ("PAYMENT_EXCEEDS_DEBT", "Amount exceeds current debt"),
}
FILTERS = {
    "agencyId": ("agencyId", "="),
    "status": ("status", "="),
    "merchantReference": ("merchantReference", "="),
    "providerTransactionId": ("providerTransactionId", "="),
    "provider": ("provider", "="),
    "providerStatus": ("providerStatus", "="),
    "createdFrom": ("createdAt", ">="),
    "createdTo": ("createdAt", "<"),
}


def not_found():
    return ApiError(404, "NOT_FOUND", "Online payment not found")


class OnlinePaymentService:
    def __init__(self, session, codec, actor_id, request_id, authorize, *, settings, adapter):
        self.session, self.codec, self.actor_id = session, codec, actor_id
        self.request_id, self.authorize = request_id, authorize
        self.settings, self.adapter = settings, adapter
        self.repo = OnlinePaymentRepository(session)

    # ----------------------------------------------------------- helpers ----

    def authorize_any(self, permissions):
        failure = None
        for permission in permissions:
            try:
                self.authorize((permission,))
                return
            except (ApiError, AuthError) as error:
                failure = error
        raise failure

    def checkout_url(self, row):
        """Locally signed VNPAY URL while the payment can still be paid, else None."""
        if (
            self.adapter is None
            or row["status"] != "PENDING"
            or row["provider"] != PROVIDER
            or row["expiresAt"] <= datetime.now(UTC)
        ):
            return None
        return (
            self.adapter.bind(row)
            .create_checkout(row["merchantReference"], row["amount"])
            .checkoutUrl
        )

    def project(self, row) -> OnlinePayment:
        values = {name: row[name] for name in OnlinePayment.model_fields if name != "checkoutUrl"}
        for name in ("id", "agencyId", "receiptDocumentId", "createdBy"):
            if values[name] is not None:
                values[name] = str(values[name])
        return OnlinePayment.model_validate({**values, "checkoutUrl": self.checkout_url(row)})

    def payment(self, identifier, *, lock=False):
        row = self.repo.get(identifier, lock=lock)
        if row is None:
            raise not_found()
        return row

    def run(self, work, *, actor_id=None, unavailable="Payment service unavailable; retry"):
        """One transaction under the payments.online audit function, committed here."""
        try:
            set_audit_context(
                self.session, actor_id, self.request_id, function_code="payments.online"
            )
            result = work()
            self.session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
            self.session.commit()
            return result
        except DBAPIError as error:
            self.session.rollback()
            state = getattr(error.orig, "sqlstate", None)
            if state == "23505":
                raise ApiError(
                    409,
                    "PAYMENT_CONFLICT",
                    "Provider transaction already belongs to another payment",
                ) from None
            mapped = translate_database_error(error, CONFLICTS)
            if mapped.status == 409:
                raise mapped from None
            raise ApiError(
                503, "PROVIDER_UNAVAILABLE", unavailable, headers={"Retry-After": "5"}
            ) from None
        except Exception:
            self.session.rollback()
            raise

    # ------------------------------------------------------------- reads ----

    def get(self, identifier) -> OnlinePayment:
        self.authorize_any(READ)
        return self.project(self.payment(identifier))

    def list(self, *, limit=25, cursor=None, sort="-createdAt", **filters) -> OnlinePaymentList:
        self.authorize_any(READ)
        rows, pagination = self.page(PAYMENT_SELECT, None, limit, cursor, sort, filters)
        return OnlinePaymentList(items=[self.project(row) for row in rows], pagination=pagination)

    def events(
        self, identifier, *, limit=25, cursor=None, sort="-createdAt", providerStatus=None
    ) -> PaymentEventList:
        self.authorize(WRITE)
        self.payment(identifier)
        rows, pagination = self.page(
            EVENT_SELECT, identifier, limit, cursor, sort, {"providerStatus": providerStatus}
        )
        return PaymentEventList(
            items=[self.project_event(row) for row in rows], pagination=pagination
        )

    def page(self, query, identifier, limit, cursor, sort, filters):
        if sort not in ("id", "-id", "createdAt", "-createdAt"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid time sort")
        start, end = filters.get("createdFrom"), filters.get("createdTo")
        if start is not None and end is not None and start >= end:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid time interval")
        resource = "payments" if identifier is None else "events"
        scope = {"operation": resource, "paymentId": identifier, "sort": sort, **filters}
        keys = (None, None) if cursor is None else self.codec.decode(cursor, scope, [datetime, int])
        desc = sort.startswith("-")
        by_id = sort.lstrip("-") == "id"
        sign = "<" if desc else ">"
        predicates, parameters = [], {"fetch": limit + 1, "time": keys[0], "id": keys[1]}
        if keys[0] is not None:
            predicates.append(
                f"p.id {sign} :id" if by_id else f'(p."createdAt", p.id) {sign} (:time, :id)'
            )
        for name, value in filters.items():
            if value is None:
                continue
            column, operation = FILTERS[name]
            predicates.append(f'p."{column}" {operation} :{name}')
            parameters[name] = int(value) if name == "agencyId" else value
        if identifier is not None:
            predicates.append('p."paymentId" = :payment')
            parameters["payment"] = identifier
        if predicates:
            query += " WHERE " + " AND ".join(predicates)
        direction = "DESC" if desc else "ASC"
        order = f"p.id {direction}" if by_id else f'p."createdAt" {direction}, p.id {direction}'
        query += f" ORDER BY {order} LIMIT :fetch"
        rows = self.repo.rows(query, parameters)
        return build_page(rows, limit, self.codec, scope, lambda row: [row["createdAt"], row["id"]])

    def project_event(self, row) -> PaymentEvent:
        """Whitelisted provider data; payload gaps fall back to the payment itself."""
        payload = row["verifiedPayload"]
        success = row["providerStatus"] == "SUCCESS"
        transaction = payload.get("providerTransactionId")
        if not isinstance(transaction, str):
            transaction = (row["sourceTransaction"] or "") if success else ""
        payment_time = payload.get("paymentTime")
        if payment_time is None and success:
            payment_time = row["sourceTime"]
        return PaymentEvent(
            id=str(row["id"]),
            paymentId=str(row["paymentId"]),
            eventKey=row["eventKey"],
            providerStatus=row["providerStatus"],
            createdAt=row["createdAt"],
            updatedAt=row["updatedAt"],
            verifiedData={
                "merchantReference": payload.get("merchantReference", row["sourceReference"]),
                "amount": payload.get("amount", row["sourceAmount"]),
                "providerTransactionId": transaction,
                "paymentTime": payment_time,
            },
        )

    # ------------------------------------------------------------ create ----

    def create(self, body, key=None) -> OnlinePayment:
        """Create (or replay by Idempotency-Key) a PENDING VNPAY checkout."""
        self.authorize(WRITE)
        if body.provider != PROVIDER or self.adapter is None:
            raise ApiError(422, "UNSUPPORTED_PROVIDER", "Payment provider is not configured")
        amount_to_vnpay(body.amount)
        key = key or uuid4()
        agency_id = int(body.agencyId)

        def replay(row):
            if (row["agencyId"], row["amount"], row["createdBy"]) != (
                agency_id,
                body.amount,
                self.actor_id,
            ):
                raise ApiError(
                    409, "IDEMPOTENCY_KEY_REUSED", "Retry key was used for another payload"
                )
            return row["id"]

        def work():
            self.authorize(WRITE)
            existing = self.repo.by_key(key)
            if existing is not None:
                return replay(existing)
            agency = self.repo.agency(agency_id, lock=True)
            if agency is None:
                raise ApiError(404, "NOT_FOUND", "Agency not found")
            if agency["status"] != "ACTIVE":
                raise ApiError(409, "AGENCY_TERMINATED", "Agency is terminated")
            if body.amount > agency["debt"]:
                raise ApiError(
                    409,
                    "PAYMENT_EXCEEDS_DEBT",
                    "Amount exceeds current debt",
                    details={"debt": str(agency["debt"]), "amount": str(body.amount)},
                )
            identifier = self.repo.create(
                agency_id,
                PROVIDER,
                body.amount,
                self.actor_id,
                key,
                self.settings.payment_expiry_seconds,
            )
            if identifier is None:  # a concurrent request with the same key committed first
                return replay(self.repo.by_key(key))
            return identifier

        identifier = self.run(work, actor_id=self.actor_id)
        return self.project(self.payment(identifier))

    # -------------------------------------------------------- completion ----

    def complete(self, provider, evidence, *, actor_id=None):
        """Apply verified provider evidence; returns (payment, duplicate)."""

        def work():
            if actor_id is not None:
                self.authorize(WRITE)
            identifier = self.repo.by_reference(provider, evidence.merchantReference)
            if identifier is None:
                raise not_found()
            row = self.payment(identifier, lock=True)
            if evidence.amount != row["amount"]:
                raise ApiError(409, "PAYMENT_CONFLICT", "Payment evidence does not match amount")
            transaction = (
                None if evidence.providerTransactionId == "0" else evidence.providerTransactionId
            )
            if transaction is not None and row["providerTransactionId"] not in (None, transaction):
                raise ApiError(409, "PAYMENT_CONFLICT", "Payment transaction differs")
            if row["status"] == "SUCCESS":
                # Successful payments are immutable; identical success is a duplicate.
                if evidence.status == "SUCCESS" and evidence.paymentTime != row["paymentTime"]:
                    raise ApiError(409, "PAYMENT_CONFLICT", "Successful payment time differs")
                return identifier, True
            if self.repo.event(identifier, evidence.eventKey) is not None:
                return identifier, True
            self.repo.append_event(identifier, evidence)
            if evidence.status == "SUCCESS":
                # Verified money is always recorded, also after local FAILED/EXPIRED and
                # when the debt is already settled (debt may go negative, handoff 3.3).
                documents = DocumentService(
                    self.session,
                    self.codec,
                    actor_id,
                    self.request_id,
                    lambda _: None,
                    kind="PAYMENT_RECEIPT",
                )
                paid_on = vietnam_date(evidence.paymentTime)
                receipt = documents.record_online_receipt(
                    row["agencyId"],
                    row["amount"],
                    business_date=min(paid_on, documents.repo.today()),
                    note=f"VNPAY {row['merchantReference']}",
                    created_by=row["createdBy"],
                )
                self.repo.mark_success(identifier, transaction, evidence.paymentTime, receipt)
            elif row["status"] == "PENDING" and evidence.status != "PENDING":
                self.repo.mark_unsuccessful(identifier, evidence.status, transaction)
            return identifier, False

        identifier, duplicate = self.run(
            work, actor_id=actor_id, unavailable="Payment completion unavailable; retry"
        )
        return self.project(self.payment(identifier)), duplicate

    def reconcile(self, identifier) -> OnlinePayment:
        """Query the provider for a PENDING payment and apply its verified outcome."""
        self.authorize(WRITE)
        row = self.payment(identifier)
        self.session.rollback()  # release the read snapshot before the network call
        if row["status"] != "PENDING":
            raise ApiError(
                409,
                "STATE_CONFLICT",
                f"Online payment is {row['status']}; only PENDING payments are reconciled",
                details={"status": row["status"]},
            )
        if self.adapter is None or row["provider"] != PROVIDER:
            raise ApiError(503, "PROVIDER_UNAVAILABLE", "Payment provider unavailable")
        evidence = self.adapter.bind(row).query_payment(row["merchantReference"])
        if evidence.merchantReference != row["merchantReference"]:
            raise ApiError(502, "INVALID_PROVIDER_RESPONSE", "Provider reference differs")
        result, _ = self.complete(row["provider"], evidence, actor_id=self.actor_id)
        return result
