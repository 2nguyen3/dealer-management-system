from app.modules.document_core.list_repository import FinancialDocumentRepository


class CreditApplicationRepository(FinancialDocumentRepository):
    kind = "CREDIT_APPLICATION"
