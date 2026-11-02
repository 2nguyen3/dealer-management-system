from datetime import date
from decimal import Decimal

from app.common.pagination import build_page, cursor_error, literal_search
from app.core.exceptions import ApiError
from app.modules.document_core.financial import agency_balance, authorize_any
from app.modules.document_core.schemas import InvoiceBalance
from app.modules.receivables.repository import ReceivableRepository
from app.modules.receivables.schemas import (
    AllocationList,
    InvoiceBalanceList,
    ReceivableEntry,
    ReceivableOverview,
    ReceivableOverviewList,
    ReceivableStatement,
)


class ReceivableService:
    def __init__(self, session, codec, actor_id, request_id, authorize):
        self.session, self.codec, self.authorize = session, codec, authorize
        self.repo = ReceivableRepository(session)

    def interval(self, start, end):
        if start is not None and end is not None and start >= end:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid business-date interval")

    def overview(
        self,
        *,
        limit=25,
        cursor=None,
        q=None,
        agencyId=None,
        typeId=None,
        districtId=None,
        debtFrom=None,
        debtTo=None,
        status=None,
        sort="-currentDebt",
    ):
        self.authorize(("debt.read",))
        field = sort.removeprefix("-")
        if field not in ("agencyId", "currentDebt", "remainingCreditLimit"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid receivable sort")
        if debtFrom is not None and debtTo is not None and debtFrom > debtTo:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid debt interval")
        filters = dict(
            q=q,
            agencyId=agencyId,
            typeId=typeId,
            districtId=districtId,
            debtFrom=debtFrom,
            debtTo=debtTo,
            status=status,
        )
        scope = {"operation": "listReceivables", "sort": sort, **filters}
        keys = (None, None) if cursor is None else self.codec.decode(cursor, scope, [int, Decimal])
        result = self.repo.overview(
            field,
            sort.startswith("-"),
            {
                **filters,
                "q": None if q is None else literal_search(q),
                "anchorId": keys[0],
                "anchorValue": keys[1],
                "fetch": limit + 1,
            },
        )
        if not result.pop("valid"):
            raise cursor_error()
        items, pagination = build_page(
            [ReceivableOverview.model_validate(row) for row in result.pop("items")],
            limit,
            self.codec,
            scope,
            lambda item: [int(item.agencyId), Decimal(str(getattr(item, field)))],
        )
        return ReceivableOverviewList(**result, items=items, pagination=pagination)

    def balance(self, identifier):
        authorize_any(self.authorize, ("debt.read", "credit.apply", "cash.refund.post"))
        return agency_balance(self.session, identifier)

    def invoice(self, identifier):
        self.authorize(("debt.read",))
        return InvoiceBalance.model_validate(self.repo.invoice(identifier))

    def invoices(
        self,
        agency_id,
        *,
        limit=25,
        cursor=None,
        code=None,
        settlementStatus=None,
        fromDate=None,
        toDate=None,
        sort="businessDate",
    ):
        self.authorize(("debt.read",))
        self.interval(fromDate, toDate)
        field = {
            "id": "issueDocumentId",
            "businessDate": "businessDate",
            "outstandingAmount": "outstandingAmount",
        }.get(sort.removeprefix("-"))
        if field is None:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid invoice sort")
        filters = dict(
            code=code, settlementStatus=settlementStatus, fromDate=fromDate, toDate=toDate
        )
        scope = {
            "operation": "listAgencyInvoiceBalances",
            "agencyId": agency_id,
            "sort": sort,
            **filters,
        }
        key_type = date if field == "businessDate" else Decimal
        keys = (None, None) if cursor is None else self.codec.decode(cursor, scope, [int, key_type])
        result = self.repo.invoices(
            agency_id,
            field,
            sort.startswith("-"),
            {**filters, "anchorId": keys[0], "anchorValue": keys[1], "fetch": limit + 1},
        )
        if not result["valid"]:
            raise cursor_error()

        def boundary(item):
            value = getattr(item, field)
            return [
                int(item.issueDocumentId),
                value if field == "businessDate" else Decimal(str(value)),
            ]

        items, pagination = build_page(
            [InvoiceBalance.model_validate(row) for row in result["items"]],
            limit,
            self.codec,
            scope,
            boundary,
        )
        return InvoiceBalanceList(items=items, pagination=pagination)

    def statement(
        self,
        agency_id,
        *,
        limit=25,
        cursor=None,
        fromDate=None,
        toDate=None,
        sourceDocumentId=None,
        issueDocumentId=None,
        kind=None,
        effectiveOnly=True,
        sort="businessDate",
        allocation=False,
        document_id=None,
    ):
        self.authorize(("debt.read",))
        self.interval(fromDate, toDate)
        if sort not in ("businessDate", "-businessDate"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid ledger sort")
        filters = dict(
            fromDate=fromDate,
            toDate=toDate,
            sourceDocumentId=sourceDocumentId,
            issueDocumentId=issueDocumentId,
            kind=kind,
            effectiveOnly=effectiveOnly,
            allocation=allocation,
        )
        scope = {
            "operation": "listDocumentAllocations" if allocation else "listAgencyReceivableEntries",
            "agencyId": agency_id,
            "documentId": document_id,
            "sort": sort,
            **filters,
        }
        keys = (
            (None, None, None)
            if cursor is None
            else self.codec.decode(cursor, scope, [date, int, int])
        )
        result = self.repo.statement(
            agency_id,
            sort.startswith("-"),
            {
                **filters,
                "cursorDate": keys[0],
                "cursorOrder": keys[1],
                "cursorId": keys[2],
                "fetch": limit + 1,
            },
        )
        items, pagination = build_page(
            [ReceivableEntry.model_validate(row) for row in result.pop("items")],
            limit,
            self.codec,
            scope,
            lambda item: [item.businessDate, int(item.businessOrder), int(item.id)],
        )
        if allocation:
            return AllocationList(items=items, pagination=pagination)
        return ReceivableStatement(**result, items=items, pagination=pagination)

    def allocations(self, identifier, **filters):
        self.authorize(("debt.read",))
        source = self.repo.allocation_source(identifier)
        field = "issueDocumentId" if source["kind"] == "STOCK_ISSUE" else "sourceDocumentId"
        return self.statement(
            source["agencyId"],
            allocation=True,
            document_id=identifier,
            **{field: identifier},
            **filters,
        )
