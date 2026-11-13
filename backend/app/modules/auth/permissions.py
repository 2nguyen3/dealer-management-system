from typing import Literal, get_args

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
    "inventory.read",
    "stock.receipt.prepare",
    "stock.receipt.post",
    "stock.issue.prepare",
    "stock.issue.post",
    "cash.receipt.prepare",
    "cash.receipt.post",
    "cash.upfront.verify",
    "stock.count",
    "stock.adjustment.prepare",
    "stock.adjustment.post",
    "returns.prepare",
    "returns.post",
    "cash.refund.prepare",
    "cash.refund.post",
    "credit.apply",
    "documents.correct",
    "documents.cancel",
    "sales.read",
    "debt.read",
    "reports.read",
    "audit.read",
    "payments.online",
]
FUNCTION_CODES = frozenset(get_args(FunctionCode))
# Retired codes stay valid only as historical audit_log references (FK RESTRICT). They are
# never granted, listed or authorized; 0010 retired district.manage with the district level.
RetiredFunctionCode = Literal["district.manage"]
RETIRED_FUNCTION_CODES = frozenset(get_args(RetiredFunctionCode))
AuditFunctionCode = Literal[(*get_args(FunctionCode), *get_args(RetiredFunctionCode))]
