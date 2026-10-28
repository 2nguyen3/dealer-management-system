from app.common.catalogue import PatchModel
from app.common.schemas import ApiModel, BusinessDate, Id, NonEmptyText, NullableText, PositiveMoney


class CreditApplicationCreate(ApiModel):
    agencyId: Id
    businessDate: BusinessDate
    amount: PositiveMoney
    note: NullableText = None


class CreditApplicationUpdate(PatchModel):
    businessDate: BusinessDate = None
    amount: PositiveMoney = None
    note: NullableText = None


class CreditApplicationCorrection(ApiModel):
    businessDate: BusinessDate
    amount: PositiveMoney
    reason: NonEmptyText
    note: NullableText = None
