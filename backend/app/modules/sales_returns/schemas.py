from app.common.schemas import ApiModel, BusinessDate, Id, NullableText, PositiveQuantity


class ReturnLineInput(ApiModel):
    originLineId: Id
    quantity: PositiveQuantity


class SalesReturnCreate(ApiModel):
    originDocumentId: Id
    businessDate: BusinessDate
    note: NullableText = None
    lines: list[ReturnLineInput] = []
