import json
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, WithJsonSchema, model_validator

from app.common.canonical import canonical_value
from app.common.schemas import ApiModel, Id, Instant, Pagination
from app.modules.auth.permissions import FunctionCode

CATALOGUES = {"user_group", "app_function", "district", "agency_type", "unit"}
ENTITIES = CATALOGUES | {
    "app_user",
    "group_permission",
    "auth_token",
    "business_rule",
    "agency",
    "product",
    "document",
    "document_revision",
    "document_line",
    "posting_batch",
    "inventory_entry",
    "receivable_entry",
    "credit_lot",
    "credit_entry",
    "credit_application",
    "refund",
    "refund_reservation",
    "refund_attempt",
    "online_payment",
    "payment_event",
    "upfront_confirmation",
    "stock_count",
    "stock_count_line",
    "agency_balance",
    "inventory_balance",
}
CATALOG_KEYS = {"groupId", "functionId", "unitId", "typeId", "districtId"}
NUMERIC_KEYS = {
    "maxDebt",
    "currentDebt",
    "currentCredit",
    "currentStock",
    "currentPurchasePrice",
    "lowStockThreshold",
    "sellingPriceRate",
    "quantity",
    "unitPrice",
    "basePurchasePrice",
    "lineAmount",
    "totalAmount",
    "amount",
    "paidAmount",
    "upfrontAmount",
    "bookQuantity",
    "countedQuantity",
    "difference",
    "priceRate",
    "cashReceived",
    "reservedAmount",
    "immediatePayment",
    "maxDebtSnapshot",
    "returnAmount",
}
ACTOR_KEYS = {
    "createdBy",
    "updatedBy",
    "readyBy",
    "postedBy",
    "cancelledBy",
    "verifiedBy",
    "confirmedBy",
}


def sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("_", "").replace("-", "")
    return any(
        word in normalized for word in ("password", "token", "secret", "digest", "hash")
    ) or normalized in {"authorization", "apikey"}


def exact_json(value) -> str:
    """Serialize arbitrary audit numbers as exact JSON numbers, never binary floats."""
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ValueError("Nonfinite audit number")
        return format(value, "f")
    if isinstance(value, dict):
        return (
            "{"
            + ",".join(json.dumps(key) + ":" + exact_json(item) for key, item in value.items())
            + "}"
        )
    if isinstance(value, list):
        return "[" + ",".join(exact_json(item) for item in value) + "]"
    return json.dumps(value, ensure_ascii=False, allow_nan=False)


def public_json(value):
    """Redact nested provider/note JSON without treating its numbers as domain values."""
    if isinstance(value, dict):
        return {key: public_json(item) for key, item in value.items() if not sensitive_key(key)}
    if isinstance(value, list):
        return [public_json(item) for item in value]
    return value


def project_snapshot(entity: str, raw: str | None) -> dict | None:
    if raw is None:
        return None
    values = json.loads(raw, parse_float=Decimal)
    return {
        key: (
            (canonical_value(value) if isinstance(value, Decimal) else str(value))
            if value is not None
            and entity in ENTITIES
            and (
                (key == "id" and entity not in CATALOGUES and entity != "business_rule")
                or (key.endswith("Id") and key not in CATALOG_KEYS)
                or key in ACTOR_KEYS | {"businessOrder"}
                or key in NUMERIC_KEYS
            )
            else public_json(value)
        )
        for key, value in values.items()
        if not sensitive_key(key)
    }


class AuditResponse(ApiModel):
    id: Id
    actorId: Id | None
    actorType: Literal["USER", "SYSTEM"]
    functionCode: FunctionCode
    action: Literal["INSERT", "UPDATE", "DELETE"]
    entityName: str
    entityKey: str
    oldData: Annotated[
        dict | None, WithJsonSchema({"type": ["object", "null"], "additionalProperties": True})
    ]
    newData: Annotated[
        dict | None, WithJsonSchema({"type": ["object", "null"], "additionalProperties": True})
    ]
    requestId: Annotated[str | None, WithJsonSchema({"type": ["string", "null"]})]
    createdAt: Instant = Field(json_schema_extra={"readOnly": True})
    updatedAt: Instant = Field(json_schema_extra={"readOnly": True})

    @model_validator(mode="before")
    @classmethod
    def project(cls, value: dict) -> dict:
        return {
            **value,
            "oldData": project_snapshot(value["entityName"], value["oldData"]),
            "newData": project_snapshot(value["entityName"], value["newData"]),
        }


class AuditListResponse(ApiModel):
    items: list[AuditResponse]
    pagination: Pagination
