"""Caller-owned composition for agency document workflows."""

from sqlalchemy import text

from app.common.catalogue import CatalogueService
from app.common.commands import CommandResult, CommandScope
from app.core.exceptions import ApiError, AuthError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.modules.document_core.schemas import (
    AgencyBalance,
    DocumentList,
    DocumentSummary,
    MutationResult,
)
from app.modules.document_core.service import DocumentService
from app.modules.inventory.repository import InventoryRepository
from app.modules.settlement_core.service import SettlementService


def authorize_any(authorize, permissions):
    for permission in permissions:
        try:
            authorize((permission,))
            return
        except AuthError as error:
            if error.status != 403 or error.code != "FORBIDDEN":
                raise
    raise AuthError(403, "FORBIDDEN", "Permission denied")


def agency_balance(session, agency_id):
    row = (
        session.execute(
            text("""
        SELECT a.id::text AS "agencyId",b."currentDebt",b."currentCredit",t."maxDebt",
          coalesce(x.reserved,0) AS "reservedCredit",
          b."currentCredit"-coalesce(x.reserved,0) AS "availableCredit",
          t."maxDebt"-b."currentDebt" AS "remainingCreditLimit",clock_timestamp() AS "asOf"
        FROM dms.agency a JOIN dms.agency_balance b ON b."agencyId"=a.id
          JOIN dms.agency_type t ON t.id=a."typeId"
          LEFT JOIN LATERAL (SELECT sum(r.amount) AS reserved FROM dms.refund_reservation r
            JOIN dms.credit_lot l ON l.id=r."lotId"
            WHERE l."agencyId"=a.id AND r.state='ACTIVE') x ON true
        WHERE a.id=:id
    """),
            {"id": agency_id},
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise ApiError(404, "NOT_FOUND", "Agency not found")
    return AgencyBalance.model_validate(dict(row))


class FinancialDocumentService(CatalogueService):
    response_model = DocumentSummary
    list_model = DocumentList
    search_fields = ("code", "note", "agencyName", "snapshotNames")
    sorts = {
        sort: (field,) if field == "id" else (field, "id")
        for field in ("id", "businessDate", "totalAmount", "createdAt")
        for sort in (field, "-" + field)
    }

    def __init__(self, session, codec, actor_id, request_id, authorize):
        super().__init__(session, codec, actor_id, request_id, authorize)
        self.core = DocumentService(session, codec, actor_id, request_id, authorize)
        self.inventory = InventoryRepository(session)
        self.settlement = SettlementService(session, actor_id, request_id, authorize)

    def get(self, identifier):
        if self.core.repo.document(identifier, lock=True)["kind"] != self.kind:
            raise ApiError(404, "NOT_FOUND", "Document kind not found")
        return self.core.get(identifier)

    def etag(self, item):
        return self.core.etag(item)

    def list(self, *, fromDate=None, toDate=None, sort="-businessDate", **filters):
        self.core.authorize_read(self.kind)
        if fromDate is not None and toDate is not None and fromDate >= toDate:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid business-date interval")
        return super().list(fromDate=fromDate, toDate=toDate, sort=sort, **filters)

    def result(self, identifier, *, status=200, products=(), location=None):
        item = self.core.get(identifier, check_permission=False)
        revision = item.currentRevision
        result = MutationResult(
            id=item.id,
            code=item.code,
            kind=item.kind,
            status=item.status,
            revisionNo=revision.revisionNo,
            revisionId=revision.id,
            businessDate=revision.businessDate,
            totalAmount=revision.totalAmount,
            immediatePayment=revision.immediatePayment,
            remainingAtIssue=getattr(item, "remainingAtIssue", None),
            autoReceiptId=getattr(item, "autoReceiptId", None),
            separateReceiptId=None,
            agencyBalance=agency_balance(self.session, int(item.agencyId)),
            inventoryChanges=self.inventory.changes(products),
        )
        headers = {"ETag": self.etag(item)}
        if location is not None:
            headers["Location"] = location
        return CommandResult(status=status, body=result.model_dump(mode="json"), headers=headers)

    def command(self, operation, scope, key, payload, permission, work):
        def authorize():
            set_audit_context(
                self.session, self.actor_id, self.request_id, function_code=permission
            )
            self.authorize((permission,))

        return TransactionRunner(self.session).run(
            CommandScope(self.actor_id, operation, scope, key),
            payload,
            authorize=authorize,
            work=work,
        )

    def lock_agency(self, agency_id, permission):
        agency = self.settlement.repo.lock_agency(agency_id)
        self.authorize((permission,))
        return agency

    def source(self, identifier):
        row = self.core.repo.document(identifier)
        if row["kind"] != self.kind:
            raise ApiError(404, "NOT_FOUND", "Document kind not found")
        return row

    def check_date(self, agency, business_date):
        if business_date < agency["acceptedDate"]:
            raise ApiError(409, "AGENCY_CONFLICT", "Business date precedes agency acceptance")

    def snapshot(self, agency):
        return {
            "agency" + name.title(): agency[name] for name in ("name", "email", "phone", "address")
        }
