"""Units must be readable by everyone who can read products.

The products page loads `/units` for its unit filter and column; a narrower unit read
set returned 403 to SALES/ACCOUNTING after the 14/11/2026 simplification.
"""

import json
from pathlib import Path

from app.modules.auth.permissions import FUNCTION_CODES
from app.modules.products.router import READ as PRODUCT_READ
from app.modules.units.router import READ as UNIT_READ

CONTRACT = Path(__file__).parents[3] / "openwiki/backend-design/API/openapi.json"
DEFAULT_GRANTS = {
    "SALES": {"agency.read", "agency.manage", "stock.issue.prepare", "sales.read", "debt.read"},
    "WAREHOUSE": {
        "agency.read",
        "unit.manage",
        "product.manage",
        "stock.receipt.prepare",
        "stock.receipt.post",
        "stock.issue.post",
    },
    "ACCOUNTING": {
        "agency.read",
        "debt.read",
        "sales.read",
        "reports.read",
        "cash.receipt.prepare",
        "cash.receipt.post",
        "payments.online",
    },
}


def test_every_product_reader_can_read_units():
    assert set(PRODUCT_READ["anyOf"]) <= set(UNIT_READ["anyOf"])
    assert "unit.manage" in UNIT_READ["anyOf"]
    assert set(UNIT_READ["anyOf"]) <= set(FUNCTION_CODES)


def test_default_roles_that_read_products_also_read_units():
    for role, grants in DEFAULT_GRANTS.items():
        reads_products = bool(grants & set(PRODUCT_READ["anyOf"]))
        assert reads_products, role
        assert grants & set(UNIT_READ["anyOf"]), role


def test_contract_publishes_the_same_unit_read_set():
    paths = json.loads(CONTRACT.read_text(encoding="utf-8"))["paths"]
    for path in ("/units", "/units/{unitId}"):
        assert paths[path]["get"]["x-permissions"] == UNIT_READ
