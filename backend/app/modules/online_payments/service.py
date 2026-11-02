from datetime import datetime
from uuid import UUID, uuid5

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
from app.common.pagination import build_page
from app.common.provider_commands import finish_provider_command
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.modules.document_core.financial import authorize_any
from app.modules.document_core.service import DocumentService
from app.modules.online_payments.repository import PAYMENT_SELECT, OnlinePaymentRepository
from app.modules.online_payments.schemas import (
    OnlinePayment,
    OnlinePaymentList,
    PaymentEvent,
    PaymentEventList,
)
from app.modules.online_payments.vnpay import (
    VnpayAdapter,
    amount_to_vnpay,
    bind_adapter,
    provider_for,
)
from app.modules.settlement_core.service import SettlementService


class OnlinePaymentService:
    def __init__(self, session, codec, actor_id, request_id, authorize, settings, adapter):
        self.session, self.codec, self.actor_id = session, codec, actor_id
        self.request_id, self.authorize = request_id, authorize
        self.settings, self.adapter = settings, adapter
        self.repo = OnlinePaymentRepository(session)
        self.settlement = SettlementService(session, actor_id, request_id, authorize)

    def project(self, row):
        values = {name: row[name] for name in OnlinePayment.model_fields}
        for name in ("id", "agencyId", "receiptDocumentId", "createdBy"):
            if values[name] is not None:
                values[name] = str(values[name])
        if values["status"] != "PENDING":
            values["checkoutUrl"] = None
        return OnlinePayment.model_validate(values)

    def get(self, identifier):
        authorize_any(self.authorize, ("payments.online", "debt.read"))
        return self.project(self.repo.get(identifier))

    def authorize_write(self):
        self.authorize(("payments.online",))
        set_audit_context(
            self.session, self.actor_id, self.request_id, function_code="payments.online"
        )

    def create(self, body, key, *, _attempt=0):
        scope = CommandScope(self.actor_id, "createOnlinePayment", "online-payments", key)
        committing = False
        try:
            self.authorize_write()
            commands = CommandRepository(self.session)
            command, fresh = commands.claim(scope, request_fingerprint(body.model_dump()))
            self.authorize_write()
            if fresh:
                if body.provider != provider_for(self.settings) or self.adapter is None:
                    raise ApiError(
                        422, "UNSUPPORTED_PROVIDER", "Payment provider is not configured"
                    )
                if isinstance(self.adapter, VnpayAdapter):
                    amount_to_vnpay(body.amount)
                agency = self.settlement.repo.lock_agency(int(body.agencyId))
                self.authorize_write()
                debt = self.settlement.repo.balance(agency["id"])["debt"]
                if body.amount > debt:
                    raise ApiError(409, "PAYMENT_EXCEEDS_DEBT", "Amount exceeds current debt")
                identifier = self.repo.create(
                    agency["id"],
                    body.provider,
                    body.amount,
                    self.actor_id,
                    internal_substep_key(command.id, "payment"),
                    self.settings.payment_expiry_seconds,
                )
                result = CommandResult(
                    status=202,
                    body=self.project(self.repo.get(identifier)).model_dump(mode="json"),
                    headers={"Location": f"/api/v1/online-payments/{identifier}"},
                )
                self.session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
                commands.complete(command, result, recovery={"paymentId": str(identifier)})
            else:
                identifier = int(command.result["body"]["id"])
            command_id = command.id
            committing = True
            self.session.commit()  # TX1: all network calls are after this point.
        except DBAPIError as error:
            self.session.rollback()
            if (
                getattr(error.orig, "sqlstate", None) in ("40001", "40P01")
                and not error.connection_invalidated
                and _attempt < 2
            ):
                return self.create(body, key, _attempt=_attempt + 1)
            if committing and (
                error.connection_invalidated or getattr(error.orig, "sqlstate", None) is None
            ):
                raise ApiError(
                    409,
                    "COMMAND_OUTCOME_UNKNOWN",
                    "Retry the same command key to recover the outcome",
                ) from None
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Payment setup unavailable; retry the same key",
                headers={"Retry-After": "5"},
            ) from None
        except Exception:
            self.session.rollback()
            raise
        return self.setup(identifier, command_id)

    def setup(self, identifier, command_id, *, report_errors=False):
        try:
            self.authorize_write()
            row = self.repo.get(identifier)
            self.session.rollback()
        except DBAPIError:
            self.session.rollback()
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Payment setup unavailable; retry the same key",
                headers={"Retry-After": "5"},
            ) from None
        if row["checkoutUrl"] is None and row["status"] == "PENDING":
            if self.adapter is None or row["provider"] != provider_for(self.settings):
                return CommandResult(
                    status=202,
                    body=self.project(row).model_dump(mode="json"),
                    headers={"Location": f"/api/v1/online-payments/{identifier}"},
                )
            try:
                checkout = bind_adapter(self.adapter, row).create_checkout(
                    row["merchantReference"], row["amount"]
                )
            except ApiError:
                if report_errors:
                    raise
                return CommandResult(
                    status=202,
                    body=self.project(row).model_dump(mode="json"),
                    headers={"Location": f"/api/v1/online-payments/{identifier}"},
                )
            try:
                self.authorize_write()
                command = self.session.scalar(
                    select(ApiCommand).where(ApiCommand.id == command_id).with_for_update()
                )
                self.authorize_write()
                self.session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
                row = self.repo.get(identifier)
                if checkout.expiresAt <= row["createdAt"]:
                    if not report_errors:
                        self.session.rollback()
                        return CommandResult(
                            status=202,
                            body=self.project(row).model_dump(mode="json"),
                            headers={"Location": f"/api/v1/online-payments/{identifier}"},
                        )
                    raise ApiError(
                        502,
                        "INVALID_PROVIDER_RESPONSE",
                        "Checkout expiry precedes payment creation",
                    )
                if command.state == "ACCEPTED":
                    # ACCEPTED cannot be rewritten; complete setup once and retain
                    # paymentId in result for detail joins and same-key recovery.
                    command.result = (
                        CommandResult(
                            status=201,
                            body={
                                **self.project(row).model_dump(mode="json"),
                                "checkoutUrl": checkout.checkoutUrl,
                            },
                            headers={"Location": f"/api/v1/online-payments/{identifier}"},
                        )
                        .checked()
                        .model_dump(mode="json")
                    )
                    command.state = "COMPLETED"
                    command.recovery = None
                    if row["status"] == "PENDING":
                        self.session.execute(
                            text('UPDATE dms.online_payment SET "expiresAt"=:expiry WHERE id=:id'),
                            {"expiry": checkout.expiresAt, "id": identifier},
                        )
                        row["expiresAt"] = checkout.expiresAt
                    row["checkoutUrl"] = checkout.checkoutUrl
                else:
                    row["checkoutUrl"] = command.result["body"]["checkoutUrl"]
                self.session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
                self.session.commit()
            except DBAPIError:
                self.session.rollback()
                try:
                    current = self.project(self.repo.get(identifier))
                    self.session.rollback()
                except DBAPIError:
                    self.session.rollback()
                    raise ApiError(
                        503,
                        "PROVIDER_UNAVAILABLE",
                        "Payment setup unavailable; retry the same key",
                        headers={"Retry-After": "5"},
                    ) from None
                return CommandResult(
                    status=202,
                    body=current.model_dump(mode="json"),
                    headers={"Location": f"/api/v1/online-payments/{identifier}"},
                )
            except Exception:
                self.session.rollback()
                raise
        return CommandResult(
            status=201 if row["checkoutUrl"] else 202,
            body=self.project(row).model_dump(mode="json"),
            headers={"Location": f"/api/v1/online-payments/{identifier}"},
        )

    def complete(self, provider, evidence):
        try:
            identifier = self.repo.reference(provider, evidence.merchantReference)
            discovered = self.repo.get(identifier)
            agency = self.settlement.repo.lock_agency(discovered["agencyId"])
            self.settlement.repo.lock_history(agency["id"])
            row = self.repo.get(identifier, lock=True)
            if self.actor_id is not None:
                self.authorize_write()
            if evidence.amount != row["amount"]:
                raise ApiError(409, "PAYMENT_CONFLICT", "Payment evidence does not match amount")
            transaction = (
                None
                if provider == "VNPAY" and evidence.providerTransactionId == "0"
                else evidence.providerTransactionId
            )
            if transaction is not None and row["providerTransactionId"] not in (None, transaction):
                raise ApiError(409, "PAYMENT_CONFLICT", "Payment transaction differs")
            if (
                row["status"] == "SUCCESS"
                and evidence.status == "SUCCESS"
                and evidence.paymentTime != row["paymentTime"]
            ):
                raise ApiError(409, "PAYMENT_CONFLICT", "Successful payment time differs")
            old = self.repo.event(identifier, evidence.eventKey)
            payload = evidence.model_dump(mode="json", exclude_unset=True)
            if old is not None:
                if old["verifiedPayload"] != payload:
                    raise ApiError(409, "PAYMENT_CONFLICT", "Event key content differs")
                result = self.project(row)
                self.session.commit()
                return result, True
            set_audit_context(self.session, None, self.request_id, function_code="payments.online")
            self.repo.append_event(identifier, evidence)
            if row["status"] != "SUCCESS" and evidence.status == "SUCCESS":
                self.session.execute(text("SET CONSTRAINTS ALL DEFERRED"))
                # Signature/reconcile is authority; preserve initiator for posting.
                core = DocumentService(
                    self.session, self.codec, row["createdBy"], self.request_id, lambda _: None
                )
                from app.common.dates import vietnam_date

                receipt = core.create_draft(
                    "PAYMENT_RECEIPT",
                    vietnam_date(evidence.paymentTime),
                    uuid5(UUID(str(row["idempotencyKey"])), "online-receipt"),
                    agencyId=agency["id"],
                    receiptType="DEBT_COLLECTION",
                    totalAmount=evidence.amount,
                    paymentMethod="ONLINE",
                )
                self.session.execute(
                    text(
                        "UPDATE dms.online_payment SET status='SUCCESS', "
                        '"providerTransactionId"=:transaction,"paymentTime"=:time,'
                        '"receiptDocumentId"=:receipt '
                        "WHERE id=:id"
                    ),
                    {
                        "transaction": transaction,
                        "time": evidence.paymentTime,
                        "receipt": receipt,
                        "id": identifier,
                    },
                )
                SettlementService(
                    self.session, row["createdBy"], self.request_id, lambda _: None
                ).post_receipt(receipt, UUID(str(row["idempotencyKey"])))
            elif row["status"] == "PENDING" and evidence.status != "SUCCESS":
                self.session.execute(
                    text(
                        "UPDATE dms.online_payment SET status=:status, "
                        '"providerTransactionId"=:transaction WHERE id=:id'
                    ),
                    {
                        "status": evidence.status,
                        "transaction": transaction,
                        "id": identifier,
                    },
                )
            self.session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
            result = self.project(self.repo.get(identifier))
            self.session.commit()
            return result, False
        except DBAPIError as error:
            self.session.rollback()
            if getattr(error.orig, "sqlstate", None) == "23505":
                raise ApiError(
                    409,
                    "PAYMENT_CONFLICT",
                    "Provider transaction already belongs to another payment",
                ) from None
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Payment completion unavailable; retry the same event",
                headers={"Retry-After": "5"},
            ) from None
        except Exception:
            self.session.rollback()
            raise

    def list(self, *, limit=25, cursor=None, sort="-createdAt", **filters):
        authorize_any(self.authorize, ("payments.online", "debt.read"))
        return self.page("payments", None, limit, cursor, sort, filters)

    def events(self, identifier, *, limit=25, cursor=None, sort="-createdAt", providerStatus=None):
        self.authorize(("payments.online",))
        self.repo.get(identifier)
        return self.page(
            "events", identifier, limit, cursor, sort, {"providerStatus": providerStatus}
        )

    def page(self, resource, identifier, limit, cursor, sort, filters):
        if sort not in ("id", "-id", "createdAt", "-createdAt"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid time sort")
        if (
            filters.get("createdFrom")
            and filters.get("createdTo")
            and filters["createdFrom"] >= filters["createdTo"]
        ):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid time interval")
        scope = {"operation": resource, "paymentId": identifier, "sort": sort, **filters}
        keys = (None, None) if cursor is None else self.codec.decode(cursor, scope, [datetime, int])
        desc = sort.startswith("-")
        predicates, parameters = [], {"fetch": limit + 1, "day": keys[0], "id": keys[1]}
        if keys[0] is not None:
            predicates.append(
                ("p.id" + ("<" if desc else ">") + ":id")
                if sort.lstrip("-") == "id"
                else '(p."createdAt",p.id)' + ("<" if desc else ">") + "(:day,:id)"
            )
        for name, value in filters.items():
            if value is not None:
                column, operation = (
                    ("createdAt", ">=" if name == "createdFrom" else "<")
                    if name in ("createdFrom", "createdTo")
                    else (name, "=")
                )
                allowed = {
                    "agencyId",
                    "status",
                    "merchantReference",
                    "providerTransactionId",
                    "provider",
                    "createdAt",
                    "providerStatus",
                }
                if column not in allowed:
                    raise ValueError("Invalid online filter")
                predicates.append(f'p."{column}"{operation}:{name}')
                parameters[name] = value
        if resource == "events":
            predicates.append('p."paymentId"=:payment')
            parameters["payment"] = identifier
        query = (
            PAYMENT_SELECT
            if resource == "payments"
            else """
            SELECT p.*, origin."merchantReference" AS "sourceReference",
              origin.amount AS "sourceAmount",origin."providerTransactionId" AS "sourceTransaction",
              origin."paymentTime" AS "sourceTime"
            FROM dms.payment_event p JOIN dms.online_payment origin ON origin.id=p."paymentId"
        """
        )
        if predicates:
            query += " WHERE " + " AND ".join(predicates)
        direction = "DESC" if desc else "ASC"
        order = (
            f"p.id {direction}"
            if sort.lstrip("-") == "id"
            else f'p."createdAt" {direction},p.id {direction}'
        )
        query += f" ORDER BY {order} LIMIT :fetch"
        rows = self.session.execute(text(query), parameters).mappings().all()
        if resource == "payments":
            models = [self.project(row) for row in rows]
            model = OnlinePaymentList
        else:
            models = [self.project_event(row) for row in rows]
            model = PaymentEventList
        items, pagination = build_page(
            models, limit, self.codec, scope, lambda item: [item.createdAt, int(item.id)]
        )
        return model(items=items, pagination=pagination)

    def project_event(self, row):
        """Whitelist business data, including immutable linkage of old demo events.

        Legacy events omitted normalized proof fields. Empty transaction text means
        no recorded historical identifier; it never verifies or records new money.
        """
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

    def reconcile(self, identifier, key):
        try:
            self.authorize_write()
            commands = CommandRepository(self.session)
            command, fresh = commands.claim(
                CommandScope(self.actor_id, "reconcileOnlinePayment", f"payment:{identifier}", key),
                request_fingerprint({}),
            )
            self.authorize_write()
            row = self.repo.get(identifier)
            if fresh:
                commands.complete(
                    command,
                    CommandResult(status=200, body=self.project(row).model_dump(mode="json")),
                    recovery={"paymentId": str(identifier)},
                )
            elif command.state == "COMPLETED":
                result = OnlinePayment.model_validate(command.result["body"])
                self.session.commit()
                return result
            command_id = command.id
            self.session.commit()
        except DBAPIError:
            self.session.rollback()
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Reconciliation unavailable; retry the same key",
                headers={"Retry-After": "5"},
            ) from None
        except Exception:
            self.session.rollback()
            raise
        if row["status"] == "SUCCESS":
            result = self.project(row)
            return self.finish_reconcile(command_id, result)
        if self.adapter is None or row["provider"] != provider_for(self.settings):
            raise ApiError(503, "PROVIDER_UNAVAILABLE", "Payment provider unavailable")
        evidence = bind_adapter(self.adapter, row).query_payment(row["merchantReference"])
        if evidence.merchantReference != row["merchantReference"]:
            raise ApiError(502, "INVALID_PROVIDER_RESPONSE", "Provider reference differs")
        self.authorize_write()
        if row["checkoutUrl"] is None and evidence.status == "PENDING":
            command = self.session.scalar(
                select(ApiCommand).where(
                    ApiCommand.operation_id == "createOnlinePayment",
                    ApiCommand.result["body"]["id"].astext == str(identifier),
                )
            )
            setup_command_id = None if command is None else command.id
            self.session.rollback()
            if setup_command_id is not None:
                self.setup(identifier, setup_command_id, report_errors=True)
        result, _ = self.complete(row["provider"], evidence)
        return self.finish_reconcile(command_id, result)

    def finish_reconcile(self, command_id, result):
        if result.status == "PENDING":
            self.session.rollback()
            return result  # ACCEPTED remains recoverable until a terminal outcome.
        try:
            saved = finish_provider_command(
                self.session,
                command_id,
                CommandResult(status=200, body=result.model_dump(mode="json")),
                self.authorize_write,
            )
            return OnlinePayment.model_validate(saved.body)
        except DBAPIError:
            raise ApiError(
                503,
                "PROVIDER_UNAVAILABLE",
                "Reconciliation result unavailable; retry the same key",
                headers={"Retry-After": "5"},
            ) from None
