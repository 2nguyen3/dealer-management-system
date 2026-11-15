"""Which backend operations become MCP tools, and the hints the LLM needs to use them.

Only read operations are wrapped: the assistant never writes business data. Each tool
forwards the caller's own Agentra bearer token, so the backend still applies its RBAC
(x-permissions) to every call exactly as for the web UI.
"""

import re

PERIOD = (
    " Period is half-open: fromDate inclusive, toDate exclusive (October 2026 = "
    "fromDate 2026-10-01, toDate 2026-11-01). Money and quantities are exact decimal strings."
)
LIST = " Paged: use limit (1-100) and pass back nextCursor to read more."

# operationId -> extra description, in the order shown to clients.
TOOLS: dict[str, str] = {
    "getCurrentUser": "Who is asking: the user profile and allowedFunctions (permission codes).",
    "getDashboard": "Monthly dashboard for month=YYYY-MM: agencies, sales trend, collections, "
    "current debt and draft counts, limited to the sections the user may read.",
    "listAgencies": "Search agencies by name or code (q), ward, type, status or debt range. "
    "Each item has id, code (DL-n), name, ward and current debt." + LIST,
    "getAgency": "One agency by numeric id (from list_agencies).",
    "listAgencyTypes": "Agency types with their maximum debt." + LIST,
    "listWards": "Wards/communes of Ho Chi Minh City." + LIST,
    "listProducts": "Search products by name or code (q) or stock range; each item has id, "
    "code (MH-n), unit, current stock and last purchase price." + LIST,
    "getProduct": "One product by numeric id (from list_products).",
    "getBusinessRules": "Business rules (max agencies per ward, selling price rate...).",
    "searchDocuments": "Search stock receipts (PN), stock issues (PX) and payment receipts (PT) "
    "by code, kind, status, agencyId, productId and businessDate range." + LIST,
    "getDocument": "One document with its lines by numeric id (from search_documents).",
    "listStockIssues": "Stock issues (goods sold to agencies) with filters." + LIST,
    "listStockReceipts": "Stock receipts (goods bought into the warehouse) with filters." + LIST,
    "listPaymentReceipts": "Payment receipts (money collected from agencies) with filters." + LIST,
    "getSalesReport": "Sales per agency of POSTED stock issues." + PERIOD,
    "getProductSalesReport": "Sales per product of POSTED stock issues." + PERIOD,
    "getDebtReport": "Agency debt in a period: opening, increase, paid, closing." + PERIOD,
    "getInventoryReport": "Stock movement per product: opening, receipts, issues, closing."
    + PERIOD,
    "getCollectionsReport": "Money collected per business day: cash, bank transfer, online."
    + PERIOD,
}

Rule = tuple[frozenset[str], frozenset[str]]


def tool_name(operation_id: str) -> str:
    """listAgencies -> list_agencies."""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", operation_id).lower()


def select_operations(spec: dict) -> dict:
    """A copy of the OpenAPI document reduced to the wrapped GET operations."""
    paths: dict[str, dict] = {}
    for path, methods in spec.get("paths", {}).items():
        operation = methods.get("get")
        if isinstance(operation, dict) and operation.get("operationId") in TOOLS:
            paths[path] = {"get": operation}
            if "parameters" in methods:
                paths[path]["parameters"] = methods["parameters"]
    missing = set(TOOLS) - {item["get"]["operationId"] for item in paths.values()}
    if missing:
        raise RuntimeError(f"Backend OpenAPI lacks operations: {sorted(missing)}")
    return {**spec, "paths": paths}


def permissions(operation: dict) -> Rule:
    """(anyOf, allOf) from the backend's x-permissions extension."""
    rule = operation.get("x-permissions") or {}
    return frozenset(rule.get("anyOf") or ()), frozenset(rule.get("allOf") or ())


def allowed(rule: Rule, granted: frozenset[str]) -> bool:
    any_of, all_of = rule
    return (not any_of or bool(any_of & granted)) and all_of <= granted
