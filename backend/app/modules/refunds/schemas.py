from typing import Literal

from pydantic import model_validator

from app.common.catalogue import PatchModel
from app.common.schemas import (
    ApiModel,
    BusinessDate,
    Id,
    Instant,
    NonEmptyText,
    NullableInstant,
    NullableText,
    Pagination,
    PositiveMoney,
)
from app.modules.document_core.schemas import PaymentMethod, Timestamps


class RefundCreate(ApiModel):
    originDocumentId: Id
    businessDate: BusinessDate
    amount: PositiveMoney
    paymentMethod: PaymentMethod
    reason: NonEmptyText = None
    note: NullableText = None


class RefundUpdate(PatchModel):
    businessDate: BusinessDate = None
    amount: PositiveMoney = None
    paymentMethod: PaymentMethod = None
    reason: NonEmptyText = None
    note: NullableText = None


class ManualRefundConfirmation(ApiModel):
    paidAt: Instant
    evidenceReference: NonEmptyText


class VerifiedRefund(ApiModel):
    merchantRefundReference: NonEmptyText
    providerRefundId: NonEmptyText | None = None
    amount: PositiveMoney
    state: Literal["PENDING", "UNKNOWN", "SUCCESS", "FAILED"]
    completedAt: NullableInstant = None
    failureReason: NullableText = None

    @model_validator(mode="after")
    def require_terminal_evidence(self):
        if self.state in ("SUCCESS", "FAILED") and self.completedAt is None:
            raise ValueError("Terminal refund requires completedAt")
        if self.state == "SUCCESS" and self.providerRefundId is None:
            raise ValueError("Successful refund requires provider identity")
        return self


class DefinitiveRefundAbsence(ApiModel):
    code: Literal["REFERENCE_NOT_FOUND"]
    definitive: Literal[True]
    merchantRefundReference: NonEmptyText


class RefundAttempt(Timestamps):
    model_config = {
        "json_schema_extra": {
            "if": {"properties": {"state": {"enum": ["SUCCESS", "FAILED"]}}},
            "then": {"properties": {"completedAt": {"type": "string", "format": "date-time"}}},
        }
    }
    id: Id
    refundDocumentId: Id
    refundRevisionId: Id
    onlinePaymentId: Id
    merchantRefundReference: str
    providerRefundId: NullableText
    amount: PositiveMoney
    state: Literal["PENDING", "UNKNOWN", "SUCCESS", "FAILED"]
    completedAt: NullableInstant
    failureReason: NullableText


class RefundAttemptList(ApiModel):
    items: list[RefundAttempt]
    pagination: Pagination


class RefundReservation(Timestamps):
    id: Id
    refundRevisionId: Id
    lotId: Id
    amount: PositiveMoney
    state: Literal["ACTIVE", "RELEASED", "CONSUMED"]


class RefundReservationList(ApiModel):
    items: list[RefundReservation]
    pagination: Pagination
