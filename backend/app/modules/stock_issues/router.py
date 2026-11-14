from app.modules.document_core.router import document_router

router = document_router(
    "STOCK_ISSUE",
    "/stock-issues",
    "Stock Issues",
    {"one": "StockIssue", "many": "StockIssues"},
    read_any=("sales.read", "debt.read", "reports.read"),
)
