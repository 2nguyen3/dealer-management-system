from typing import Literal

from app.common.catalogue import PatchModel
from app.common.schemas import ApiModel, BusinessDate, Id, NullableText, PositiveMoney

ManualPaymentMethod = Literal["CASH", "BANK_TRANSFER"]


class PaymentReceiptCreate(ApiModel):
    agencyId: Id
    businessDate: BusinessDate
    amount: PositiveMoney
    paymentMethod: ManualPaymentMethod
    note: NullableText = None


class PaymentReceiptUpdate(PatchModel):
    businessDate: BusinessDate = None
    amount: PositiveMoney = None
    paymentMethod: ManualPaymentMethod = None
    note: NullableText = None
