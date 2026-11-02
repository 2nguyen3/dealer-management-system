from typing import Literal

from app.common.schemas import (
    ApiModel,
    Id,
    Instant,
    NonEmptyText,
    NullableText,
    Pagination,
    PositiveMoney,
)
from app.modules.document_core.schemas import AgencyBalance, PaymentReceipt, Timestamps
from app.modules.payment_receipts.schemas import ManualPaymentMethod

UpfrontState = Literal["VERIFIED", "CONSUMED", "RECEIVED_SEPARATELY"]


class UpfrontCreate(ApiModel):
    issueRevisionId: Id
    amount: PositiveMoney
    method: ManualPaymentMethod
    receivedAt: Instant
    evidenceReference: NonEmptyText = None


class UpfrontConfirmation(Timestamps):
    id: Id
    issueDocumentId: Id
    issueRevisionId: Id
    agencyId: Id
    amount: PositiveMoney
    method: ManualPaymentMethod
    receivedAt: Instant
    verifiedBy: Id
    verifiedAt: Instant
    evidenceReference: NullableText
    state: UpfrontState
    receiptDocumentId: Id | None


class UpfrontList(ApiModel):
    items: list[UpfrontConfirmation]
    pagination: Pagination


class UpfrontSeparated(ApiModel):
    confirmation: UpfrontConfirmation
    receipt: PaymentReceipt
    agencyBalance: AgencyBalance
