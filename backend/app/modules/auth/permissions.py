from typing import Literal, get_args

# The 22 functions of the simplified model (0011, handoff 4.3).
FunctionCode = Literal[
    "users.manage",
    "groups.manage",
    "permissions.manage",
    "rules.manage",
    "agency_type.manage",
    "unit.manage",
    "product.manage",
    "agency.read",
    "agency.manage",
    "stock.receipt.prepare",
    "stock.receipt.post",
    "stock.issue.prepare",
    "stock.issue.post",
    "cash.receipt.prepare",
    "cash.receipt.post",
    "documents.correct",
    "documents.cancel",
    "sales.read",
    "debt.read",
    "reports.read",
    "audit.read",
    "payments.online",
]
FUNCTION_CODES = frozenset(get_args(FunctionCode))
# 0011 rebuilt the schema, so no retired code survives in audit_log; kept for typing.
RETIRED_FUNCTION_CODES: frozenset[str] = frozenset()
AuditFunctionCode = FunctionCode
