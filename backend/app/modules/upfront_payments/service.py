from app.common.catalogue import CatalogueService
from app.common.commands import CommandResult, internal_substep_key
from app.common.dates import vietnam_date
from app.core.exceptions import ApiError
from app.modules.document_core.financial import (
    FinancialDocumentService,
    agency_balance,
    authorize_any,
)
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.upfront_payments.repository import UpfrontRepository
from app.modules.upfront_payments.schemas import UpfrontConfirmation, UpfrontList, UpfrontSeparated


class UpfrontPaymentService(FinancialDocumentService):
    repository = UpfrontRepository
    response_model = UpfrontConfirmation
    list_model = UpfrontList
    operation = "listUpfrontConfirmations"
    permission = "cash.upfront.verify"
    sorts = {
        sort: (field,) if field == "id" else (field, "id")
        for field in ("id", "createdAt")
        for sort in (field, "-" + field)
    }

    def get(self, identifier):
        authorize_any(
            self.authorize, ("cash.upfront.verify", "cash.receipt.post", "stock.issue.post")
        )
        return CatalogueService.get(self, identifier)

    def etag(self, item):
        return CatalogueService.etag(self, item)

    def list(self, *, createdFrom=None, createdTo=None, sort="-createdAt", **filters):
        authorize_any(
            self.authorize, ("cash.upfront.verify", "cash.receipt.post", "stock.issue.post")
        )
        if createdFrom is not None and createdTo is not None and createdFrom >= createdTo:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid creation-time interval")
        return CatalogueService.list(
            self, createdFrom=createdFrom, createdTo=createdTo, sort=sort, **filters
        )

    def verify(self, body, key):
        def work(command):
            source = self.repo.source(int(body.issueRevisionId))
            agency = self.lock_agency(source["agencyId"], self.permission)
            self.settlement.repo.lock_history(agency["id"])
            self.authorize((self.permission,))
            source = self.repo.source(int(body.issueRevisionId))
            if (
                source["status"] != "PENDING"
                or source["state"] != "READY"
                or source["currentRevisionId"] != int(body.issueRevisionId)
            ):
                raise ApiError(
                    409,
                    "UPFRONT_CONFLICT",
                    "Only the current pending READY revision can receive verification",
                )
            if (
                source["immediatePayment"] != body.amount
                or self.repo.for_revision(int(body.issueRevisionId)) is not None
            ):
                raise ApiError(409, "UPFRONT_CONFLICT", "Amount differs or evidence already exists")
            self.check_date(agency, vietnam_date(body.receivedAt))
            identifier = self.repo.insert(body, self.actor_id)

            def project():
                item = self.get(identifier)
                return CommandResult(
                    status=201,
                    body=item.model_dump(mode="json"),
                    headers={
                        "ETag": self.etag(item),
                        "Location": f"/api/v1/upfront-confirmations/{identifier}",
                    },
                )

            return project

        return self.command(
            "verifyUpfrontPayment",
            "upfront-confirmations",
            key,
            body.model_dump(),
            self.permission,
            work,
        )

    def separate(self, identifier, reason, condition, key):
        def work(command):
            found = self.get(identifier)
            agency = self.lock_agency(int(found.agencyId), "cash.receipt.post")
            self.settlement.repo.lock_history(agency["id"])
            self.repo.for_revision(int(found.issueRevisionId), lock=True)
            self.authorize(("cash.receipt.post",))
            found = self.get(identifier)
            condition.compare(self.etag(found))
            source = self.repo.source(int(found.issueRevisionId))
            if found.state != "VERIFIED" or source["status"] == "POSTED":
                raise ApiError(
                    409, "UPFRONT_CONFLICT", "Only unconsumed received money can be separated"
                )
            receipts = PaymentReceiptService(
                self.session, self.codec, self.actor_id, self.request_id, self.authorize
            )
            receipt_id = receipts.create_internal(
                agency,
                vietnam_date(found.receivedAt),
                found.amount,
                found.method,
                internal_substep_key(command.id, "separate-receipt"),
                receipt_type="RECEIVED_UNAPPLIED",
                origin=int(found.issueDocumentId),
                note=reason.reason,
            )
            self.repo.finish(identifier, "RECEIVED_SEPARATELY", receipt_id)
            self.settlement.post_receipt(receipt_id, command.id)

            def project():
                confirmation = self.get(identifier)
                result = UpfrontSeparated(
                    confirmation=confirmation,
                    receipt=self.core.get(receipt_id, check_permission=False),
                    agencyBalance=agency_balance(self.session, agency["id"]),
                )
                return CommandResult(
                    status=200,
                    body=result.model_dump(mode="json"),
                    headers={"ETag": self.etag(confirmation)},
                )

            return project

        return self.command(
            "receiveUpfrontSeparately",
            f"upfront:{identifier}",
            key,
            reason.model_dump(),
            "cash.receipt.post",
            work,
        )
