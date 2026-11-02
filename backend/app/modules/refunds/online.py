from uuid import uuid4

from psycopg.types.json import Jsonb
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.common.commands import (
    ApiCommand,
    CommandRepository,
    CommandResult,
    CommandScope,
    internal_substep_key,
    request_fingerprint,
)
from app.common.provider_commands import finish_provider_command
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.modules.online_payments.vnpay import bind_adapter
from app.modules.refunds.schemas import RefundAttempt
from app.modules.refunds.service import RefundService


class OnlineRefundService(RefundService):
    def __init__(self, session, codec, actor_id, request_id, authorize, adapter, provider=None):
        super().__init__(session, codec, actor_id, request_id, authorize)
        self.adapter = adapter
        self.provider = provider

    def attempt(self, identifier, *, lock=False):
        row = (
            self.session.execute(
                text(
                    'SELECT a.*,r."documentId" AS "refundDocumentId" '
                    "FROM dms.refund_attempt a JOIN dms.document_revision r "
                    'ON r.id=a."refundRevisionId" '
                    "WHERE a.id=:id" + (" FOR UPDATE OF a" if lock else "")
                ),
                {"id": identifier},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Refund attempt not found")
        return dict(row)

    def project_attempt(self, row):
        values = {name: row[name] for name in RefundAttempt.model_fields}
        for name in ("id", "refundDocumentId", "refundRevisionId", "onlinePaymentId"):
            values[name] = str(values[name])
        return RefundAttempt.model_validate(values)

    def request(self, identifier, condition, key, *, _attempt=0):
        committing = False
        try:
            self.authorize(("cash.refund.post",))
            set_audit_context(
                self.session, self.actor_id, self.request_id, function_code="cash.refund.post"
            )
            commands = CommandRepository(self.session)
            command, fresh = commands.claim(
                CommandScope(self.actor_id, "requestOnlineRefund", f"refund:{identifier}", key),
                request_fingerprint({}),
            )
            self.authorize(("cash.refund.post",))
            if fresh:
                if self.adapter is None:
                    raise ApiError(
                        503,
                        "PROVIDER_UNAVAILABLE",
                        "Refund provider unavailable",
                        headers={"Retry-After": "5"},
                    )
                document, revision, _ = self.lock_draft(identifier, condition, "cash.refund.post")
                if revision["paymentMethod"] != "ONLINE":
                    raise ApiError(409, "STATE_CONFLICT", "Refund is not online")
                prior = (
                    self.session.execute(
                        text(
                            'SELECT * FROM dms.refund_attempt WHERE "refundRevisionId"=:id '
                            "ORDER BY id DESC LIMIT 1"
                        ),
                        {"id": revision["id"]},
                    )
                    .mappings()
                    .one_or_none()
                )
                if prior is not None:
                    if prior["state"] != "FAILED":
                        raise ApiError(
                            409,
                            "STATE_CONFLICT",
                            "Unresolved or successful refund cannot be retried",
                        )
                    self.session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
                    new = self.core.new_revision(
                        identifier,
                        revision["businessDate"],
                        "Retry definitively failed payout",
                        totalAmount=revision["totalAmount"],
                        paymentMethod="ONLINE",
                        note=revision["note"],
                    )
                    self.session.execute(
                        text('UPDATE dms.document SET "currentRevisionId"=:revision WHERE id=:id'),
                        {"revision": new, "id": identifier},
                    )
                    self.reservations().reserve(identifier)
                    revision = self.core.repo.lock_current(identifier)[1]
                rows = self.settlement.repo.reservations(revision["id"])
                if (
                    not rows
                    or any(row["state"] != "ACTIVE" for row in rows)
                    or sum(row["amount"] for row in rows) != revision["totalAmount"]
                ):
                    raise ApiError(
                        409, "STATE_CONFLICT", "Online payout requires full active reservation"
                    )
                payment = (
                    self.session.execute(
                        text(
                            'SELECT id,provider,"merchantReference" FROM dms.online_payment '
                            "WHERE \"receiptDocumentId\"=:id AND status='SUCCESS'"
                        ),
                        {"id": document["originDocumentId"]},
                    )
                    .mappings()
                    .one()
                )
                if self.provider is not None and payment["provider"] != self.provider:
                    raise ApiError(
                        503,
                        "PROVIDER_UNAVAILABLE",
                        "Original payment provider is not configured",
                        headers={"Retry-After": "5"},
                    )
                attempt_id = self.session.scalar(
                    text(
                        'INSERT INTO dms.refund_attempt ("refundRevisionId","onlinePaymentId",'
                        '"idempotencyKey","merchantRefundReference",amount) '
                        "VALUES (:revision,:payment,:key,:reference,:amount) RETURNING id"
                    ),
                    {
                        "revision": revision["id"],
                        "payment": payment["id"],
                        "key": internal_substep_key(command.id, "attempt"),
                        "reference": "AGENTRA-REF-" + uuid4().hex,
                        "amount": revision["totalAmount"],
                    },
                )
                result = CommandResult(
                    status=202,
                    body=self.project_attempt(self.attempt(attempt_id)).model_dump(mode="json"),
                )
                commands.complete(
                    command,
                    result,
                    recovery={
                        "attemptId": str(attempt_id),
                        "initiatingActorId": str(self.actor_id),
                    },
                )
                self.session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
            else:
                attempt_id = int(command.result["body"]["id"])
            committing = True
            self.session.commit()
        except DBAPIError as error:
            self.session.rollback()
            if (
                getattr(error.orig, "sqlstate", None) in ("40001", "40P01")
                and not error.connection_invalidated
                and _attempt < 2
            ):
                return self.request(identifier, condition, key, _attempt=_attempt + 1)
            if committing and (
                error.connection_invalidated or getattr(error.orig, "sqlstate", None) is None
            ):
                raise ApiError(
                    409,
                    "COMMAND_OUTCOME_UNKNOWN",
                    "Retry the same refund key to recover the outcome",
                ) from None
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Payout intent unavailable; retry same key",
                headers={"Retry-After": "5"},
            ) from None
        except Exception:
            self.session.rollback()
            raise
        return self.dispatch(attempt_id, query=not fresh, recover=not fresh)

    def dispatch(self, identifier, *, query=False, recover=False):
        self.authorize(("cash.refund.post",))
        attempt = self.attempt(identifier)
        if attempt["state"] in ("SUCCESS", "FAILED"):
            self.session.rollback()
            return self.project_attempt(attempt)
        if self.adapter is None:
            self.session.rollback()
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Refund provider unavailable",
                headers={"Retry-After": "5"},
            )
        query = query or (attempt["state"] == "UNKNOWN" and not recover)
        payment = (
            self.session.execute(
                text("SELECT * FROM dms.online_payment WHERE id=:id"),
                {"id": attempt["onlinePaymentId"]},
            )
            .mappings()
            .one()
        )
        self.session.rollback()
        if self.provider is not None and payment["provider"] != self.provider:
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Original payment provider is not configured",
                headers={"Retry-After": "5"},
            )
        adapter = bind_adapter(self.adapter, payment, attempt, self.actor_id)
        try:
            evidence = (
                adapter.query_refund(attempt["merchantRefundReference"])
                if query
                else adapter.request_refund(
                    attempt["merchantRefundReference"],
                    payment["merchantReference"],
                    attempt["amount"],
                )
            )
        except ApiError as error:
            self.mark_unknown(identifier)
            if recover and error.code == "PROVIDER_REFERENCE_NOT_FOUND":
                # Authoritative absence permits recovering only the existing payout
                # identity. A normal reconcile never initiates a transfer.
                return self.dispatch(identifier, query=False, recover=True)
            if query and not recover:
                if error.code == "PROVIDER_REFERENCE_NOT_FOUND":
                    raise ApiError(
                        502, "INVALID_PROVIDER_RESPONSE", "Provider has no verified payout outcome"
                    ) from None
                raise
            return self.project_attempt(self.attempt(identifier))
        try:
            return self.complete_attempt(identifier, evidence)
        except ApiError as error:
            if error.status not in (502, 503):
                raise
            self.mark_unknown(identifier)
            if query and not recover:
                raise
            return self.project_attempt(self.attempt(identifier))

    def mark_unknown(self, identifier):
        try:
            set_audit_context(self.session, None, self.request_id, function_code="cash.refund.post")
            discovered = self.attempt(identifier)
            self.lock_agency(
                self.source(discovered["refundDocumentId"])["agencyId"], "cash.refund.post"
            )
            self.settlement.repo.lock_history(
                self.source(discovered["refundDocumentId"])["agencyId"]
            )
            row = self.attempt(identifier, lock=True)
            self.authorize(("cash.refund.post",))
            if row["state"] == "PENDING":
                self.session.execute(
                    text("UPDATE dms.refund_attempt SET state='UNKNOWN' WHERE id=:id"),
                    {"id": identifier},
                )
            self.session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise

    def complete_attempt(self, identifier, evidence):
        try:
            discovered = self.attempt(identifier)
            source = self.source(discovered["refundDocumentId"])
            agency = self.lock_agency(source["agencyId"], "cash.refund.post")
            self.settlement.repo.lock_history(agency["id"])
            row = self.attempt(identifier, lock=True)
            self.authorize(("cash.refund.post",))
            if (
                evidence.merchantRefundReference != row["merchantRefundReference"]
                or evidence.amount != row["amount"]
            ):
                raise ApiError(
                    502, "INVALID_PROVIDER_RESPONSE", "Refund evidence identity or amount differs"
                )
            if row["state"] in ("SUCCESS", "FAILED"):
                stored = row["verifiedResponse"] or {}
                if (
                    evidence.state != row["state"]
                    or evidence.providerRefundId != row["providerRefundId"]
                    or evidence.completedAt != row["completedAt"]
                    or evidence.failureReason != row["failureReason"]
                    or (stored and stored != evidence.model_dump(mode="json"))
                ):
                    raise ApiError(409, "REFUND_CONFLICT", "Terminal payout evidence differs")
                self.session.rollback()
                return self.project_attempt(row)
            command = self.session.scalar(
                select(ApiCommand).where(
                    ApiCommand.operation_id == "requestOnlineRefund",
                    ApiCommand.recovery["attemptId"].astext == str(identifier),
                )
            )
            if command is None:
                raise ApiError(409, "STATE_CONFLICT", "Payout initiating actor recovery is missing")
            set_audit_context(
                self.session,
                command.actor_id,
                self.request_id,
                function_code="cash.refund.post",
            )
            self.session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
            self.session.execute(
                text(
                    'UPDATE dms.refund_attempt SET state=:state,"providerRefundId"=:provider,'
                    '"completedAt"=:completed,"failureReason"=:reason,'
                    '"verifiedResponse"=:payload WHERE id=:id'
                ),
                {
                    "id": identifier,
                    "state": evidence.state,
                    "provider": evidence.providerRefundId,
                    "completed": evidence.completedAt,
                    "reason": evidence.failureReason,
                    "payload": Jsonb(evidence.model_dump(mode="json")),
                },
            )
            if evidence.state == "SUCCESS":
                initiating = command.actor_id
                _, revision = self.core.repo.lock_current(row["refundDocumentId"])
                original = self.actor_id
                self.actor_id = initiating
                try:
                    self.post_paid(
                        row["refundDocumentId"],
                        revision,
                        agency,
                        evidence.completedAt,
                        evidence.providerRefundId,
                        command.id,
                    )
                finally:
                    self.actor_id = original
            elif evidence.state == "FAILED":
                self.reservations().release(row["refundDocumentId"])
            self.session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
            result = self.project_attempt(self.attempt(identifier))
            self.session.commit()
            return result
        except DBAPIError as error:
            self.session.rollback()
            if getattr(error.orig, "sqlstate", None) == "23505":
                raise ApiError(
                    409,
                    "REFUND_CONFLICT",
                    "Provider payout identity already belongs to another attempt",
                ) from None
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Payout completion unavailable; reconcile same attempt",
                headers={"Retry-After": "5"},
            ) from None
        except Exception:
            self.session.rollback()
            raise

    def reconcile(self, identifier, key):
        try:
            self.authorize(("cash.refund.post",))
            set_audit_context(
                self.session, self.actor_id, self.request_id, function_code="cash.refund.post"
            )
            commands = CommandRepository(self.session)
            command, fresh = commands.claim(
                CommandScope(self.actor_id, "reconcileRefundAttempt", f"attempt:{identifier}", key),
                request_fingerprint({}),
            )
            self.authorize(("cash.refund.post",))
            item = self.project_attempt(self.attempt(identifier))
            if fresh:
                commands.complete(
                    command,
                    CommandResult(status=200, body=item.model_dump(mode="json")),
                    recovery={"attemptId": str(identifier)},
                )
            elif command.state == "COMPLETED":
                result = RefundAttempt.model_validate(command.result["body"])
                self.session.commit()
                return result
            command_id = command.id
            self.session.commit()
        except DBAPIError:
            self.session.rollback()
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Payout reconciliation unavailable; retry same key",
                headers={"Retry-After": "5"},
            ) from None
        except Exception:
            self.session.rollback()
            raise
        item = self.dispatch(identifier, query=True)
        if item.state in ("PENDING", "UNKNOWN"):
            self.session.rollback()
            return item
        try:
            result = finish_provider_command(
                self.session,
                command_id,
                CommandResult(status=200, body=item.model_dump(mode="json")),
                lambda: self.authorize(("cash.refund.post",)),
            )
            return RefundAttempt.model_validate(result.body)
        except DBAPIError:
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Payout result unavailable; retry same key",
                headers={"Retry-After": "5"},
            ) from None
