from app.modules.document_core.list_repository import FinancialDocumentRepository


class PaymentReceiptRepository(FinancialDocumentRepository):
    kind = "PAYMENT_RECEIPT"
