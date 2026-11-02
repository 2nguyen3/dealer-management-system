from typing import Annotated, Literal

from pydantic import WithJsonSchema, model_validator

from app.common.schemas import (
    ApiModel,
    Id,
    Instant,
    NonEmptyText,
    NullableInstant,
    NullableText,
    Pagination,
    PositiveMoney,
)
from app.modules.document_core.schemas import Timestamps

PaymentStatus = Literal["PENDING", "SUCCESS", "FAILED", "EXPIRED"]


class OnlinePaymentCreate(ApiModel):
    agencyId: Id
    provider: NonEmptyText
    amount: PositiveMoney


class VerifiedPayment(ApiModel):
    eventKey: NonEmptyText
    merchantReference: NonEmptyText
    providerTransactionId: NonEmptyText
    amount: PositiveMoney
    status: PaymentStatus
    paymentTime: Instant = None

    model_config = {
        "extra": "forbid",
        "hide_input_in_errors": True,
        "json_schema_extra": {
            "if": {"properties": {"status": {"const": "SUCCESS"}}},
            "then": {"required": ["paymentTime"]},
        },
    }

    @model_validator(mode="after")
    def require_success_time(self):
        if self.status == "SUCCESS" and self.paymentTime is None:
            raise ValueError("Successful payment requires paymentTime")
        return self


class Checkout(ApiModel):
    checkoutUrl: NonEmptyText
    expiresAt: Instant


class OnlinePayment(Timestamps):
    model_config = {
        "json_schema_extra": {
            "if": {"properties": {"status": {"const": "SUCCESS"}}},
            "then": {
                "properties": {
                    "providerTransactionId": {"type": "string", "minLength": 1, "pattern": r"\S"},
                    "paymentTime": {"type": "string", "format": "date-time"},
                    "receiptDocumentId": {"type": "string", "pattern": r"^[1-9][0-9]{0,18}$"},
                }
            },
            "else": {"properties": {"receiptDocumentId": {"type": "null"}}},
        }
    }
    id: Id
    agencyId: Id
    provider: str
    merchantReference: str
    providerTransactionId: NullableText
    amount: PositiveMoney
    status: PaymentStatus
    expiresAt: Instant
    paymentTime: NullableInstant
    receiptDocumentId: Id | None
    createdBy: Id | None
    checkoutUrl: Annotated[
        str | None, WithJsonSchema({"type": ["string", "null"], "format": "uri"})
    ]

    @model_validator(mode="after")
    def validate_terminal_evidence(self):
        if self.status == "SUCCESS":
            if (
                self.receiptDocumentId is None
                or self.paymentTime is None
                or not self.providerTransactionId
            ):
                raise ValueError("Successful payment requires receipt and provider evidence")
        elif self.receiptDocumentId is not None:
            raise ValueError("Unsuccessful payment cannot have a receipt")
        return self


class VerifiedData(ApiModel):
    merchantReference: str
    amount: PositiveMoney
    providerTransactionId: str
    paymentTime: NullableInstant = None


class PaymentEvent(Timestamps):
    id: Id
    paymentId: Id
    eventKey: str
    providerStatus: PaymentStatus
    verifiedData: VerifiedData


class OnlinePaymentList(ApiModel):
    items: list[OnlinePayment]
    pagination: Pagination


class PaymentEventList(ApiModel):
    items: list[PaymentEvent]
    pagination: Pagination


class WebhookAcknowledgement(ApiModel):
    accepted: Literal[True]
    duplicate: bool
    paymentId: Id
    status: PaymentStatus
    receiptDocumentId: Id | None
