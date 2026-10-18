from typing import Annotated, Literal

from pydantic import Field

from app.common.schemas import (
    ApiModel,
    BusinessDate,
    CatalogId,
    DerivedSellingPrice,
    Id,
    Instant,
    Money,
    NonZeroQuantity,
    NullableInstant,
    NullableText,
    Pagination,
    PriceRate,
    Quantity,
)

DocumentKind = Literal[
    "STOCK_RECEIPT",
    "STOCK_ISSUE",
    "PAYMENT_RECEIPT",
    "STOCK_ADJUSTMENT",
    "SALES_RETURN",
    "CREDIT_APPLICATION",
    "REFUND",
]
DocumentStatus = Literal["DRAFT", "PENDING", "POSTED", "CANCELLED"]
RevisionState = Literal["DRAFT", "READY", "POSTED"]
PaymentMethod = Literal["CASH", "BANK_TRANSFER", "ONLINE"]
ReceiptType = Literal["AUTO_FROM_ISSUE", "DEBT_COLLECTION", "RECEIVED_UNAPPLIED"]


class Timestamps(ApiModel):
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})


class AgencySnapshot(ApiModel):
    name: str
    address: NullableText
    phone: NullableText
    email: Annotated[str, Field(pattern=r"^\S+@\S+$", json_schema_extra={"format": "email"})]


class DocumentLine(Timestamps):
    id: Id
    lineNo: Annotated[int, Field(ge=1)]
    productId: Id
    productName: str
    unitId: CatalogId
    unitName: str
    quantity: NonZeroQuantity
    unitPrice: Money
    lineAmount: Money
    basePurchasePrice: Money | None
    originLineId: Id | None
    returnAmount: Money | None


class Revision(Timestamps):
    id: Id
    documentId: Id
    revisionNo: Annotated[int, Field(ge=1)]
    state: RevisionState
    businessDate: BusinessDate
    totalAmount: Money
    immediatePayment: Money
    sellingPriceRate: PriceRate | None
    maxDebtSnapshot: Money | None
    paymentMethod: PaymentMethod | None
    agencySnapshot: AgencySnapshot | None
    reason: NullableText
    note: NullableText
    createdBy: Id | None
    readyBy: Id | None
    readyAt: NullableInstant
    postedBy: Id | None
    postedAt: NullableInstant
    lines: list[DocumentLine]


class Document(Timestamps):
    id: Id
    code: Annotated[
        str,
        Field(
            pattern=r"^(PN|PX|PT|DC|TH|BT|HT)-[1-9][0-9]*$", json_schema_extra={"readOnly": True}
        ),
    ]
    kind: DocumentKind
    agencyId: Id | None
    originDocumentId: Id | None
    receiptType: ReceiptType | None
    status: DocumentStatus
    currentRevision: Revision
    createdBy: Id | None
    cancelledBy: Id | None
    cancelledAt: NullableInstant
    cancelReason: NullableText


class StockReceipt(Document):
    kind: Literal["STOCK_RECEIPT"]
    agencyId: None
    receiptType: None
    status: Literal["DRAFT", "POSTED", "CANCELLED"]


class InvoiceBalance(ApiModel):
    issueDocumentId: Id
    code: str
    agencyId: Id
    businessDate: BusinessDate
    totalAmount: Money
    outstandingAmount: Money
    settlementStatus: Literal["UNSETTLED", "PARTIAL", "SETTLED"]


class StockIssue(Document):
    kind: Literal["STOCK_ISSUE"]
    agencyId: Id
    receiptType: None
    remainingAtIssue: Money
    invoiceBalance: InvoiceBalance | None
    upfrontConfirmationId: Id | None
    autoReceiptId: Id | None


class PaymentReceipt(Document):
    kind: Literal["PAYMENT_RECEIPT"]
    agencyId: Id
    receiptType: ReceiptType
    status: Literal["DRAFT", "POSTED", "CANCELLED"]
    appliedAmount: Money
    creditCreatedAmount: Money
    onlinePaymentId: Id | None


class StockAdjustment(Document):
    kind: Literal["STOCK_ADJUSTMENT"]
    agencyId: None
    receiptType: None
    status: Literal["DRAFT", "POSTED", "CANCELLED"]
    stockCountId: Id | None


class SalesReturn(Document):
    kind: Literal["SALES_RETURN"]
    agencyId: Id
    originDocumentId: Id
    receiptType: None
    status: Literal["DRAFT", "POSTED", "CANCELLED"]
    debtReducedAmount: Money
    creditCreatedAmount: Money


class CreditApplication(Document):
    kind: Literal["CREDIT_APPLICATION"]
    cashReceived: Literal["0"]
    creditUsedAmount: Money


class Refund(Document):
    kind: Literal["REFUND"]
    reservedAmount: Money
    refundedAmount: Money
    latestAttemptId: Id | None
    latestAttemptState: Literal["PENDING", "UNKNOWN", "SUCCESS", "FAILED"] | None


DOCUMENT_MODELS = {
    "STOCK_RECEIPT": StockReceipt,
    "STOCK_ISSUE": StockIssue,
    "PAYMENT_RECEIPT": PaymentReceipt,
    "STOCK_ADJUSTMENT": StockAdjustment,
    "SALES_RETURN": SalesReturn,
    "CREDIT_APPLICATION": CreditApplication,
    "REFUND": Refund,
}


class DraftLine(ApiModel):
    """Internal prepared-line input. Owning modules supply kind-specific validators."""

    kind: DocumentKind
    productId: Id
    quantity: NonZeroQuantity
    unitPrice: Money
    basePurchasePrice: Money | None = None
    originLineId: Id | None = None
    returnAmount: Money | None = None


class DocumentSummary(Timestamps):
    id: Id
    code: str
    kind: DocumentKind
    agencyId: Id | None
    agencyName: NullableText
    originDocumentId: Id | None
    receiptType: ReceiptType | None
    status: DocumentStatus
    revisionNo: Annotated[int, Field(ge=1)]
    businessDate: BusinessDate
    totalAmount: Money
    immediatePayment: Money
    remainingAtIssue: Money | None
    paymentMethod: PaymentMethod | None
    outstandingAmount: Money | None
    settlementStatus: Literal["UNSETTLED", "PARTIAL", "SETTLED"] | None


class DocumentList(ApiModel):
    items: list[DocumentSummary]
    pagination: Pagination


class AgencyBalance(ApiModel):
    agencyId: Id
    currentDebt: Money
    currentCredit: Money
    reservedCredit: Money
    availableCredit: Money
    maxDebt: Money
    remainingCreditLimit: Money
    asOf: Instant


class InventoryChange(ApiModel):
    productId: Id
    currentStock: Quantity
    currentPurchasePrice: Money
    currentSellingPrice: DerivedSellingPrice


class MutationResult(ApiModel):
    id: Id
    code: str
    kind: DocumentKind
    status: DocumentStatus
    revisionNo: Annotated[int, Field(ge=1)]
    revisionId: Id
    businessDate: BusinessDate
    totalAmount: Money
    immediatePayment: Money
    remainingAtIssue: Money | None
    autoReceiptId: Id | None
    separateReceiptId: Id | None
    agencyBalance: AgencyBalance | None
    inventoryChanges: list[InventoryChange]
