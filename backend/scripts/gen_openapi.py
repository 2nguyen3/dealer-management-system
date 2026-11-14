"""Regenerate openwiki/backend-design/API/openapi.json from the runtime FastAPI app.

The runtime document is authoritative after the 14/11/2026 simplification. Shared
components of the previous hand-written contract (parameters, responses, headers and
scalar value schemas) are kept when the runtime document does not define them; object
schemas nothing references any more are dropped.

Run from ``backend/``: ``uv run python -m scripts.gen_openapi [previous-contract.json]``.
"""

import json
import re
import sys
from pathlib import Path
from typing import get_args

from pydantic import SecretStr

from app.core.config import Settings
from app.main import create_app
from app.modules.auth.permissions import FUNCTION_CODES
from app.modules.document_core import schemas as documents

CONTRACT = Path(__file__).resolve().parents[2] / "openwiki/backend-design/API/openapi.json"
PREFIX = "/api/v1"
METHODS = {"get", "post", "put", "patch", "delete"}
# Value schemas of features removed on 14/11/2026; never carried over.
RETIRED = {
    "CreditEntryKind",
    "ManualPaymentMethod",
    "PaymentMethod",
    "ReceivableKind",
    "RefundAttemptState",
    "ReservationState",
    "RevisionState",
    "SettlementStatus",
    "StockCountState",
    "UpfrontState",
}
# Transport components of removed features (counts, credit, returns, upfront, line
# editing, idempotent commands, chatbot, provider webhooks); never carried over.
RETIRED_SHARED = {
    "AttemptId",
    "ChatbotValidation",
    "ConfirmationId",
    "CountConflict",
    "CountId",
    "CreditConflict",
    "EffectiveOnly",
    "IdempotencyConflict",
    "IdempotencyKey",
    "LedgerSort",
    "LineConflict",
    "LineId",
    "LotId",
    "OriginFilter",
    "ReturnConflict",
    "RevisionNo",
    "SettlementFilter",
    "SourceDocumentFilter",
    "UpfrontConflict",
    "WebhookKeyId",
    "WebhookTimestamp",
}
# Shared enums documented from the runtime Literal types, not the old contract.
ENUMS = {
    "FunctionCode": FUNCTION_CODES,
    "AuditFunctionCode": FUNCTION_CODES,
    "DocumentKind": get_args(documents.DocumentKind),
    "DocumentStatus": get_args(documents.DocumentStatus),
    "ReceiptType": get_args(documents.ReceiptType),
    "ManualReceiptType": get_args(documents.ManualReceiptType),
}
DESCRIPTION = (
    "Agentra DMS business API after the 14/11/2026 simplification: three document kinds "
    "(stock receipts, stock issues, payment receipts), agency debt and product stock columns, "
    "VNPAY online payments, document history, reports and dashboard. Generated from the runtime "
    "application; this file is the contract the frontend uses."
)


PATTERN = re.compile(r'"#/components/([A-Za-z]+)/([^"/]+)"')


def shared(old_components: dict) -> set[tuple[str, str]]:
    """Transport components of the old contract: headers, parameters, error responses."""
    roots = {("headers", name) for name in old_components.get("headers", {})}
    roots |= {("parameters", name) for name in old_components.get("parameters", {})}
    for name, response in old_components.get("responses", {}).items():
        refs = set(PATTERN.findall(json.dumps(response)))
        if ("schemas", "Error") in refs and all(
            section == "headers" or ref == "Error" for section, ref in refs
        ):
            roots.add(("responses", name))
    return {(section, name) for section, name in roots if name not in RETIRED_SHARED}


def reachable(document: dict, roots: set[tuple[str, str]] | None = None) -> set[tuple[str, str]]:
    """Components (section, name) reachable from paths, top-level security and ``roots``."""
    components = document["components"]
    pattern = PATTERN
    reached: set[tuple[str, str]] = set()
    if roots is None:
        body = {key: value for key, value in document.items() if key != "components"}
        roots = set(pattern.findall(json.dumps(body)))
    frontier = set(roots)
    while frontier:
        reached |= frontier
        found = set()
        for section, name in frontier:
            body = json.dumps(components.get(section, {}).get(name, {}))
            found |= {match for match in pattern.findall(body)} - reached
        frontier = found
    return reached


def build(old: dict) -> dict:
    settings = Settings(
        _env_file=None,
        db_host="localhost",
        db_user="u",
        db_password=SecretStr("p"),
        auth_signing_key=SecretStr("x" * 40),
    )
    runtime = create_app(settings).openapi()
    runtime["paths"] = {
        (key[len(PREFIX) :] or "/"): value for key, value in runtime["paths"].items()
    }
    old_components = old.get("components", {})
    components = runtime.setdefault("components", {})
    own = {(section, name) for section, items in components.items() for name in items}
    for section in ("parameters", "responses", "securitySchemes", "headers", "schemas"):
        merged = {**old_components.get(section, {}), **components.get(section, {})}
        if merged:
            components[section] = merged
    schemas = components["schemas"]
    # Shared scalar value schemas (Id, Money, ...) of the old contract stay documented.
    scalar = {
        ("schemas", name)
        for name, schema in old_components.get("schemas", {}).items()
        if name not in RETIRED
        and schema.get("type") != "object"
        and "properties" not in schema
        and "$ref" not in json.dumps(schema)
    }
    keep = own | scalar | reachable(runtime) | reachable(runtime, shared(old_components))
    for section, items in components.items():
        for name in [name for name in items if (section, name) not in keep]:
            del items[name]
    for name, values in ENUMS.items():
        ordered = sorted(values) if "FunctionCode" in name else list(values)
        schemas[name] = {**schemas.get(name, {}), "type": "string", "enum": ordered}
    for key in ("servers", "security"):
        if key in old:
            runtime[key] = old[key]
    if "info" in old:
        runtime["info"] = {**old["info"], "version": "2026-11-14-simplified"}
    runtime["info"]["description"] = DESCRIPTION
    return runtime


def main() -> None:
    # Optional argument: a previous contract to carry shared components from.
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else CONTRACT
    old = json.loads(source.read_text(encoding="utf-8"))
    document = build(old)
    CONTRACT.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", "utf-8")
    operations = sum(
        1 for item in document["paths"].values() for method in item if method in METHODS
    )
    print(f"operations {operations} schemas {len(document['components']['schemas'])}")


if __name__ == "__main__":
    main()
