from datetime import date, datetime

from app.common.pagination import build_page
from app.core.exceptions import ApiError
from app.modules.agency_credit.repository import CreditRepository
from app.modules.agency_credit.schemas import CreditEntry, CreditLot, CreditLotList, CreditStatement
from app.modules.document_core.financial import authorize_any
from app.modules.settlement_core.service import SettlementService

READ = ("debt.read", "credit.apply", "cash.refund.post")


class AvailableCreditService:
    """Internal read under caller-owned writer locks; no reserve/consume/commit."""

    def __init__(self, session, actor_id, request_id, authorize):
        self.settlement = SettlementService(session, actor_id, request_id, authorize)

    def available(self, agency_id, *, permission, receipt_id=None):
        self.settlement.lock(agency_id, permission)
        return self.settlement.repo.available(agency_id, receipt_id=receipt_id)


class AgencyCreditService:
    def __init__(self, session, codec, actor_id, request_id, authorize):
        self.session, self.codec, self.authorize = session, codec, authorize
        self.repo = CreditRepository(session)

    def lot(self, identifier):
        authorize_any(self.authorize, READ)
        return CreditLot.model_validate(self.repo.lot(identifier))

    def lots(
        self,
        agency_id,
        *,
        limit=25,
        cursor=None,
        originReceiptId=None,
        availableOnly=False,
        sort="-createdAt",
    ):
        authorize_any(self.authorize, READ)
        self.repo.agency(agency_id)
        if sort not in ("id", "-id", "createdAt", "-createdAt"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid credit-lot sort")
        scope = {
            "operation": "listAgencyCreditLots",
            "agencyId": agency_id,
            "originReceiptId": originReceiptId,
            "availableOnly": availableOnly,
            "sort": sort,
        }
        keys = (None, None) if cursor is None else self.codec.decode(cursor, scope, [datetime, int])
        rows = self.repo.lots(
            agency_id,
            sort,
            {
                "receipt": originReceiptId,
                "available": availableOnly,
                "anchor": keys[1],
                "time": keys[0],
                "fetch": limit + 1,
            },
        )
        items, pagination = build_page(
            [CreditLot.model_validate(row) for row in rows],
            limit,
            self.codec,
            scope,
            lambda item: [item.createdAt, int(item.id)],
        )
        return CreditLotList(items=items, pagination=pagination)

    def statement(
        self,
        agency_id,
        *,
        limit=25,
        cursor=None,
        fromDate=None,
        toDate=None,
        lotId=None,
        kind=None,
        sourceDocumentId=None,
        effectiveOnly=True,
        sort="businessDate",
    ):
        self.authorize(("debt.read",))
        if fromDate is not None and toDate is not None and fromDate >= toDate:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid credit interval")
        if sort not in ("businessDate", "-businessDate"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid credit-entry sort")
        filters = dict(
            fromDate=fromDate,
            toDate=toDate,
            lotId=lotId,
            kind=kind,
            sourceDocumentId=sourceDocumentId,
            effectiveOnly=effectiveOnly,
        )
        scope = {
            "operation": "listAgencyCreditEntries",
            "agencyId": agency_id,
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
            [CreditEntry.model_validate(row) for row in result.pop("items")],
            limit,
            self.codec,
            scope,
            lambda item: [item.businessDate, int(item.businessOrder), int(item.id)],
        )
        return CreditStatement(**result, items=items, pagination=pagination)
