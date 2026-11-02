from sqlalchemy import BigInteger, Boolean, DateTime, Integer, Numeric, String, column, table

PRODUCT = table(
    "product",
    column("id", BigInteger),
    column("code", String),
    column("name", String),
    column("unitId", Integer),
    column("lowStockThreshold", Numeric),
    column("status", String),
    column("createdAt", DateTime(timezone=True)),
    column("updatedAt", DateTime(timezone=True)),
    schema="dms",
)
BALANCE = table(
    "inventory_balance",
    column("productId", BigInteger),
    column("currentStock", Numeric),
    column("currentPurchasePrice", Numeric),
    column("priceSourceLineId", BigInteger),
    schema="dms",
)
RULE = table(
    "business_rule", column("id", Boolean), column("sellingPriceRate", Numeric), schema="dms"
)
