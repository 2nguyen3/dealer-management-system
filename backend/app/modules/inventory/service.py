from datetime import date

from app.common.pagination import build_page
from app.core.exceptions import ApiError
from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.schemas import InventoryEntry, InventoryStatement


class InventoryService:
    def __init__(self, session, codec, actor_id, request_id, authorize):
        self.repo = InventoryRepository(session)
        self.codec = codec
        self.authorize = authorize

    def statement(
        self,
        product_id: int,
        *,
        limit=25,
        cursor=None,
        fromDate=None,
        toDate=None,
        sourceDocumentId=None,
        effectiveOnly=True,
        sort="businessDate",
    ) -> InventoryStatement:
        self.authorize(("inventory.read",))
        if fromDate is not None and toDate is not None and fromDate >= toDate:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid business-date interval")
        if sort not in ("businessDate", "-businessDate"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid inventory sort")
        scope = {
            "operation": "listProductInventoryEntries",
            "productId": product_id,
            "fromDate": fromDate,
            "toDate": toDate,
            "sourceDocumentId": sourceDocumentId,
            "effectiveOnly": effectiveOnly,
            "sort": sort,
        }
        keys = (
            (None, None, None)
            if cursor is None
            else self.codec.decode(cursor, scope, [date, int, int])
        )
        result = self.repo.statement(
            product_id,
            descending=sort.startswith("-"),
            fromDate=fromDate,
            toDate=toDate,
            sourceDocumentId=None if sourceDocumentId is None else int(sourceDocumentId),
            effectiveOnly=effectiveOnly,
            cursorDate=keys[0],
            cursorOrder=keys[1],
            cursorId=keys[2],
            fetch=limit + 1,
        )
        items, pagination = build_page(
            [InventoryEntry.model_validate(row) for row in result.pop("items")],
            limit,
            self.codec,
            scope,
            lambda entry: [entry.businessDate, int(entry.businessOrder), int(entry.id)],
        )
        return InventoryStatement(**result, items=items, pagination=pagination)
