"""Shared contract of the three simplified document kinds (handoff 3.1)."""

from typing import Annotated, Literal

from pydantic import Field

from app.common.schemas import (
    ApiModel,
    BusinessDate,
    CatalogId,
    Id,
    Instant,
    Money,
    NonEmptyText,
    NullableInstant,
    NullableText,
    Pagination,
    PositiveMoney,
    PositiveQuantity,
    PriceRate,
    SignedMoney,
)

DocumentKind = Literal["STOCK_RECEIPT", "STOCK_ISSUE", "PAYMENT_RECEIPT"]
DocumentStatus = Literal["DRAFT", "POSTED", "CANCELLED"]
ReceiptType = Literal["CASH", "BANK_TRANSFER", "ONLINE"]
ManualReceiptType = Literal["CASH", "BANK_TRANSFER"]
DocumentCode = Annotated[
    str, Field(pattern=r"^(PN|PX|PT)-[1-9][0-9]*$", json_schema_extra={"readOnly": True})
]


class DocumentLine(ApiModel):
    id: Id
    lineNo: Annotated[int, Field(ge=1)]
    productId: Id
    productCode: str
    productName: str
    unitId: CatalogId
    unitName: str
    quantity: PositiveQuantity
    unitPrice: Money
    lineAmount: Money


class DocumentReference(ApiModel):
    id: Id
    code: DocumentCode
    status: DocumentStatus


class DocumentSummary(ApiModel):
    id: Id
    code: DocumentCode
    kind: DocumentKind
    status: DocumentStatus
    businessDate: BusinessDate
    agencyId: Id | None
    agencyCode: NullableText
    agencyName: NullableText
    receiptType: ReceiptType | None
    totalAmount: Money
    lineCount: Annotated[int, Field(ge=0)]
    note: NullableText
    replacesDocumentId: Id | None
    replacedByDocumentId: Id | None
    createdBy: Id | None
    createdByName: NullableText
    postedBy: Id | None
    postedByName: NullableText
    postedAt: NullableInstant
    cancelledAt: NullableInstant
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})


class Document(DocumentSummary):
    sellingPriceRate: PriceRate | None
    cancelledBy: Id | None
    cancelledByName: NullableText
    cancelReason: NullableText
    replaces: DocumentReference | None
    replacedBy: DocumentReference | None
    onlinePaymentId: Id | None
    agencyDebt: SignedMoney | None = Field(description="Current agency debt (may be negative).")
    agencyMaxDebt: Money | None
    lines: list[DocumentLine]


class DocumentList(ApiModel):
    items: list[DocumentSummary]
    pagination: Pagination


# ----------------------------------------------------------------- inputs ----


class ReceiptLineInput(ApiModel):
    productId: Id
    quantity: PositiveQuantity
    unitPrice: PositiveMoney


class IssueLineInput(ApiModel):
    productId: Id
    quantity: PositiveQuantity


class StockReceiptInput(ApiModel):
    businessDate: BusinessDate | None = None
    note: NullableText = None
    lines: list[ReceiptLineInput] = []


class StockIssueInput(ApiModel):
    agencyId: Id
    businessDate: BusinessDate | None = None
    note: NullableText = None
    lines: list[IssueLineInput] = []


class PaymentReceiptInput(ApiModel):
    agencyId: Id
    businessDate: BusinessDate | None = None
    receiptType: ManualReceiptType = "CASH"
    amount: PositiveMoney
    note: NullableText = None


class Reason(ApiModel):
    reason: NonEmptyText


class StockReceiptCorrection(Reason):
    businessDate: BusinessDate | None = None
    note: NullableText = None
    lines: Annotated[list[ReceiptLineInput], Field(min_length=1)]


class StockIssueCorrection(Reason):
    businessDate: BusinessDate | None = None
    note: NullableText = None
    lines: Annotated[list[IssueLineInput], Field(min_length=1)]


class PaymentReceiptCorrection(Reason):
    businessDate: BusinessDate | None = None
    receiptType: ManualReceiptType = "CASH"
    amount: PositiveMoney
    note: NullableText = None


INPUTS = {
    "STOCK_RECEIPT": StockReceiptInput,
    "STOCK_ISSUE": StockIssueInput,
    "PAYMENT_RECEIPT": PaymentReceiptInput,
}
CORRECTIONS = {
    "STOCK_RECEIPT": StockReceiptCorrection,
    "STOCK_ISSUE": StockIssueCorrection,
    "PAYMENT_RECEIPT": PaymentReceiptCorrection,
}
