from app.modules.document_core.router import document_router

router = document_router(
    "STOCK_RECEIPT",
    "/stock-receipts",
    "Stock Receipts",
    {"one": "StockReceipt", "many": "StockReceipts"},
    read_any=("product.manage", "reports.read"),
)
