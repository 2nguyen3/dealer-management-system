from app.modules.document_core.router import document_router

router = document_router(
    "PAYMENT_RECEIPT",
    "/payment-receipts",
    "Payment Receipts",
    {"one": "PaymentReceipt", "many": "PaymentReceipts"},
    read_any=("debt.read", "payments.online", "reports.read"),
)
