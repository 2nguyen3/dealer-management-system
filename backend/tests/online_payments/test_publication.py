from app.main import create_app
from tests.online_payments.test_vnpay import config
from tests.support.contract import SOURCE


def test_source_packet_preserves_provider_operations_with_owning_corrections():
    document = create_app(config()).openapi()
    business = {
        operation["operationId"]
        for path, methods in document["paths"].items()
        if not path.startswith("/api/v1/health")
        for method, operation in methods.items()
        if method in {"get", "post", "put", "patch", "delete"}
    }
    canonical = {
        operation["operationId"]
        for methods in SOURCE["paths"].values()
        for operation in methods.values()
        if isinstance(operation, dict) and "operationId" in operation
    }
    assert len(business) == 153
    assert canonical - business == {"queryChatbot"}
    assert business <= canonical
    assert {
        "createOnlinePayment",
        "receiveVerifiedPaymentWebhook",
        "requestOnlineRefund",
        "confirmManualRefundPaid",
        "reconcileRefundAttempt",
        "searchDocuments",
        "printDocument",
    } <= business
    assert {
        prefix + suffix
        for prefix in ("correct", "cancel")
        for suffix in (
            "StockReceipt",
            "PaymentReceipt",
            "StockAdjustment",
            "StockIssue",
            "SalesReturn",
            "CreditApplication",
        )
    } <= business
    assert {
        "getSalesReport",
        "getDebtReport",
        "getInventoryReport",
        "getProductSalesReport",
        "getCashAndCreditReport",
    } <= business
    assert document["paths"]["/api/v1/dashboard"]["get"]["operationId"] == "getDashboard"
    assert "/api/v1/chatbot/queries" not in document["paths"]
