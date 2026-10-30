"""Read-only consistency checks for the backend execution plan (standard library)."""

import ast
import json
import re
from collections import Counter
from decimal import ROUND_HALF_UP, Decimal, localcontext
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[4]
BACKEND_DESIGN = ROOT / "openwiki/backend-design"
PACKAGE = BACKEND_DESIGN / "plan/full_backend"
SHARED = BACKEND_DESIGN / "plan/shared_api"
METHODS = {"get", "post", "put", "patch", "delete", "options", "head", "trace"}
OWNING_CHILDREN = (
    "users", "districts", "agency_types", "units", "permissions", "audit_logs",
    "business_rules", "products", "agencies",
    "document_core", "inventory", "stock_receipts", "settlement_core",
    "stock_issues", "payment_receipts", "upfront_payments", "receivables",
    "stock_adjustments", "stock_counts", "sales_returns", "agency_credit",
    "credit_applications", "online_payments", "refunds", "document_history",
    "document_corrections", "reports", "dashboard",
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check_references(value: object, source: dict) -> int:
    count = 0
    if isinstance(value, dict):
        if "$ref" in value:
            reference = value["$ref"]
            require(reference.startswith("#/"), f"Unexpected external reference: {reference}")
            target = source
            for part in reference[2:].split("/"):
                target = target[part.replace("~1", "/").replace("~0", "~")]
            count += 1
        for child in value.values():
            count += check_references(child, source)
    elif isinstance(value, list):
        for child in value:
            count += check_references(child, source)
    return count


def check_operations(source: dict) -> dict:
    operations = {}
    declared_tags = {tag["name"] for tag in source["tags"]}
    tags = set()
    codes = set(source["components"]["schemas"]["FunctionCode"]["enum"])
    for path, item in source["paths"].items():
        for method, operation in item.items():
            if method not in METHODS:
                continue
            identifier = operation["operationId"]
            require(identifier not in operations, f"Duplicate source operation: {identifier}")
            operations[identifier] = (method.upper(), path, operation["tags"])
            tags.update(operation["tags"])
            policy = operation.get("x-permissions", {})
            used = set(policy.get("allOf", []) + policy.get("anyOf", []))
            require(used <= codes, f"Unknown permission on {identifier}: {used - codes}")
    require(tags == declared_tags, "Declared and used API tags differ")
    require(len(operations) == 154, "Target changed: update the 154-operation planning baseline")
    require(len(tags) == 28 and len(codes) == 33, "Target tag/permission baseline changed")

    rows = re.findall(
        r"^\| (\w+) \| (GET|POST|PUT|PATCH|DELETE) \| (/[^|]+) \| "
        r"(\w+) \| (M\d{2}) \| (M\d{2}) \|$",
        text(PACKAGE / "OPERATIONS.md"),
        re.MULTILINE,
    )
    counts = Counter(row[0] for row in rows)
    require(all(count == 1 for count in counts.values()), "Duplicate planned operation")
    require(
        set(counts) == set(operations),
        f"Operation inventory mismatch: {set(counts) ^ set(operations)}",
    )
    for identifier, method, path, _owner, first, full in rows:
        require(
            (method, path.strip()) == operations[identifier][:2],
            f"Wrong method/path for {identifier}",
        )
        require(first <= full, f"Full gate precedes first delivery: {identifier}")
    print(
        f"PASS: {len(operations)} unique operations, "
        f"{len(tags)} API areas, {len(codes)} permissions"
    )
    return {row[0]: row[3:] for row in rows}


def resolve_reference(value: dict, source: dict) -> dict:
    while "$ref" in value:
        target = source
        for part in value["$ref"][2:].split("/"):
            target = target[part.replace("~1", "/").replace("~0", "~")]
        value = target
    return value


def check_transport(source: dict) -> None:
    counts = Counter()
    for path, item in source["paths"].items():
        for method, operation in item.items():
            if method not in METHODS:
                continue
            identifier = operation["operationId"]
            parameters = {}
            for group in (item.get("parameters", []), operation.get("parameters", [])):
                seen = set()
                for raw in group:
                    parameter = resolve_reference(raw, source)
                    key = (parameter["in"], parameter["name"])
                    require(key not in seen, f"Duplicate parameter on {identifier}: {key}")
                    seen.add(key)
                    parameters[key] = parameter
            path_parameters = {name for location, name in parameters if location == "path"}
            require(
                path_parameters == set(re.findall(r"\{([^}]+)\}", path)),
                f"Path parameter mismatch: {identifier}",
            )
            for name in path_parameters:
                require(parameters[("path", name)].get("required"), f"Optional path: {identifier}")
            headers = {name for location, name in parameters if location == "header"}
            for header in ("If-Match", "If-None-Match", "Idempotency-Key"):
                counts[header] += header in headers
            if "requestBody" in operation:
                body = resolve_reference(operation["requestBody"], source)
                require(body.get("required"), f"Reassess optional body: {identifier}")
                require("application/json" in body["content"], f"Non-JSON body: {identifier}")
                counts["json"] += 1
            elif method in {"post", "put", "patch"}:
                counts["bodyless"] += 1
            if any(
                parameter.get("required") and name == "If-Match" and location == "header"
                for (location, name), parameter in parameters.items()
            ):
                require("428" in operation["responses"], f"Missing 428: {identifier}")
            if "Idempotency-Key" in headers:
                require("409" in operation["responses"], f"Missing intent conflict: {identifier}")
    print(
        f"PASS: transport metadata: {counts['json']} JSON bodies, "
        f"{counts['bodyless']} bodyless actions, {counts['If-Match']} If-Match, "
        f"{counts['If-None-Match']} If-None-Match, {counts['Idempotency-Key']} intent keys"
    )


def check_roadmap(inventory: dict) -> None:
    roadmap = text(BACKEND_DESIGN / "GENERAL_PLAN.md")
    slices = {}
    edges = set()
    for line in roadmap.splitlines():
        if not re.match(r"^\| M\d{2} \|", line):
            continue
        cells = [cell.strip() for cell in line.split("|")[1:-1]]
        identifier = cells[0]
        require(identifier not in slices, f"Duplicate roadmap slice {identifier}")
        slices[identifier] = re.search(r"`(\w+)`", cells[1]).group(1)
        for dependency in re.findall(r"M\d{2}", cells[3]):
            edges.add((dependency, identifier))
    expected = {f"M{number:02}" for number in range(1, 33)}
    require(set(slices) == expected, "Roadmap must cover exactly M01-M32")
    graph_edges = set(re.findall(r"\b(M\d{2})(?:\[[^\]\n]*\])? --> (M\d{2})", roadmap))
    require(edges == graph_edges, f"Graph/table edge mismatch: {edges ^ graph_edges}")
    reached = set()
    while len(reached) < len(slices):
        ready = {
            node
            for node in slices
            if node not in reached
            and all(parent in reached for parent, child in edges if child == node)
        }
        require(bool(ready), "Roadmap contains cyclic/unknown prerequisites")
        reached.update(ready)
    work_packages = re.findall(r"^## (M\d{2}) —", text(PACKAGE / "MODULES.md"), re.MULTILINE)
    require(Counter(work_packages) == Counter(expected), "Work packages must cover each slice once")
    for identifier, (owner, first, full) in inventory.items():
        require(owner in slices.values(), f"Unknown owner for {identifier}: {owner}")
        require(first in slices and full in slices, f"Unknown gate for {identifier}")
    print(f"PASS: {len(slices)} work packages, {len(edges)} matching acyclic dependency edges")

    checklist = text(BACKEND_DESIGN / "GENERAL_CHECKLIST.md")
    tracked = re.findall(r"^- \[[ x]\] (M\d{2}) `([^`]+)`", checklist, re.MULTILINE)
    require(
        Counter(identifier for identifier, _ in tracked) == Counter(expected),
        "Backend tracking IDs differ",
    )
    require(dict(tracked) == slices, "Backend checklist module names differ")
    for identifier, section in re.findall(
        r"^## (M\d{2}) —[^\n]*\n(.*?)(?=^## M\d{2} —|\Z)",
        text(PACKAGE / "MODULES.md"),
        re.MULTILINE | re.DOTALL,
    ):
        prerequisites = re.search(r"\*\*Prerequisites:\*\* ([^.]+)\.", section)
        require(prerequisites is not None, f"Missing prerequisites: {identifier}")
        declared = set(re.findall(r"M\d{2}", prerequisites.group(1)))
        require(
            declared == {parent for parent, child in edges if child == identifier},
            f"Work-package prerequisites differ: {identifier}",
        )
    print("PASS: backend checklist names and work-package prerequisites match roadmap")


def check_frontend_roadmap() -> None:
    frontend = ROOT / "openwiki/frontend-design"
    roadmap = text(frontend / "GENERAL_PLAN.md")
    slices = {}
    edges = set()
    backend_ids = {f"M{number:02}" for number in range(1, 33)}
    for line in roadmap.splitlines():
        if not re.match(r"^\| F\d{2} \|", line):
            continue
        cells = [cell.strip() for cell in line.split("|")[1:-1]]
        identifier = cells[0]
        require(identifier not in slices, f"Duplicate frontend slice: {identifier}")
        slices[identifier] = re.search(r"`(\w+)`", cells[1]).group(1)
        edges.update((parent, identifier) for parent in re.findall(r"F\d{2}", cells[3]))
        require(
            set(re.findall(r"M\d{2}", cells[4])) <= backend_ids,
            f"Unknown backend gate: {identifier}",
        )
    expected = {f"F{number:02}" for number in range(1, 33)}
    require(set(slices) == expected, "Frontend must cover F01-F32")
    graph_edges = set(re.findall(r"\b(F\d{2})(?:\[[^\]\n]*\])? --> (F\d{2})", roadmap))
    require(edges == graph_edges, "Frontend dependency graph/table mismatch")
    reached = set()
    while len(reached) < len(slices):
        ready = {
            node
            for node in slices
            if node not in reached
            and all(parent in reached for parent, child in edges if child == node)
        }
        require(bool(ready), "Frontend dependency cycle/unknown prerequisite")
        reached.update(ready)
    tracked = re.findall(
        r"^- \[[ x]\] (F\d{2}) `([^`]+)`", text(frontend / "GENERAL_CHECKLIST.md"), re.MULTILINE
    )
    require(
        Counter(identifier for identifier, _ in tracked) == Counter(expected),
        "Frontend tracking IDs differ",
    )
    require(dict(tracked) == slices, "Frontend checklist module names differ")
    print(f"PASS: 32 frontend slices/checklist names, {len(edges)} matching acyclic edges")


def check_auth_baseline(source: dict) -> None:
    tree = ast.parse(text(ROOT / "backend/app/modules/auth/router.py"))
    implemented = {}
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in METHODS
        ):
            for keyword in node.keywords:
                if keyword.arg == "operation_id" and isinstance(keyword.value, ast.Constant):
                    require(keyword.value.value not in implemented, "Duplicate auth route ID")
                    implemented[keyword.value.value] = (
                        node.func.attr,
                        "/auth" + node.args[0].value,
                    )
    source_auth = {
        operation["operationId"]: (method, path)
        for path, item in source["paths"].items()
        for method, operation in item.items()
        if method in METHODS and "Authentication" in operation["tags"]
    }
    require(implemented == source_auth and len(implemented) == 7, "Auth baseline IDs changed")
    print("PASS: seven auth IDs/methods/paths match route declarations (static inspection)")


def check_storage_and_price_baseline(source: dict) -> None:
    ddl = text(ROOT / "backend/alembic/sql/0001_initial.sql")
    tables = set(re.findall(r"^CREATE TABLE (\w+) \(", ddl, re.MULTILINE))
    models = set()
    for path in (ROOT / "backend/app/modules").glob("*/models.py"):
        models.update(re.findall(r'__tablename__ = "(\w+)"', text(path)))
    require(len(tables) == 29 and len(models) == 8 and models <= tables, "Storage baseline changed")
    versions = {}
    for path in (ROOT / "backend/alembic/versions").glob("*.py"):
        values = {}
        for node in ast.parse(text(path)).body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id in {"revision", "down_revision"}:
                        values[target.id] = ast.literal_eval(node.value)
        if "revision" in values:
            require(values["revision"] not in versions, "Duplicate migration revision")
            versions[values["revision"]] = values["down_revision"]
    require(
        versions == {
            "0001": None, "0002": "0001", "0003": "0002", "0004": "0003",
            "0005": "0004", "0006": "0005", "0007": "0006", "0008": "0007",
            "0009": "0008",
        },
        "Update migration baseline",
    )
    schemas = source["components"]["schemas"]
    purchase, rate = "600000000000000000", "2"
    require(
        re.fullmatch(schemas["Money"]["pattern"], purchase) is not None,
        "Price witness input changed",
    )
    require(
        re.fullmatch(schemas["PriceRate"]["pattern"], rate) is not None,
        "Rate witness input changed",
    )
    with localcontext() as context:
        context.prec = 60
        derived = format(
            (Decimal(purchase) * Decimal(rate)).quantize(Decimal(1), rounding=ROUND_HALF_UP), "f"
        )
    require(
        re.fullmatch(schemas["Money"]["pattern"], derived) is None, "Reassess D16 range mismatch"
    )
    require(re.fullmatch(schemas["DerivedSellingPrice"]["pattern"], derived) is not None,
            "D16 derived quote must remain representable")
    for schema_name in ("Product", "InventoryChange"):
        schema = schemas[schema_name]
        properties = schema.get("properties", schema.get("allOf", [{}, {}])[-1].get("properties"))
        require(properties["currentSellingPrice"]["$ref"] == "#/components/schemas/DerivedSellingPrice",
                "D16 quote projection differs from canonical decision")
    print("PASS: static storage baseline: 29 domain tables, 8 domain ORM mappings, source head 0009")
    print(f"PASS: D16 witness: valid {purchase} x {rate} = {derived}, outside Money, valid derived quote")
    for schema_name, field in (("InventoryStatement", "openingStock"),
                               ("InventoryStatement", "closingStock"),
                               ("InventoryEntry", "balanceAfter"),
                               ("InventoryReportRow", "openingStock"),
                               ("InventoryReportRow", "closingStock")):
        schema = schemas[schema_name]
        properties = schema.get("properties", schema.get("allOf", [{}, {}])[-1].get("properties"))
        require(properties[field]["$ref"] == "#/components/schemas/AggregateQuantity",
                "D14 historical statement balance must remain an aggregate quantity")


def check_registers() -> None:
    tests = text(SHARED / "TESTS.md")
    checklist = text(SHARED / "CHECKLIST.md")
    register = re.findall(r"^\| (SA\d{2}) \|", tests, re.MULTILINE)
    tracked = re.findall(r"^- \[[ x]\] (SA\d{2}) —", checklist, re.MULTILINE)
    expected = Counter(f"SA{number:02}" for number in range(1, 19))
    # TESTS retains the original planning table and the completed actual-symbol table.
    require(
        Counter(register) == Counter({key: 2 * count for key, count in expected.items()})
        and Counter(tracked) == expected,
        "M02 proposed/actual symbol/checklist mismatch",
    )
    for prefix, size in (("A", 26), ("C", 14)):
        registered = re.findall(
            rf"^\| ({prefix}\d{{2}}) \|", text(PACKAGE / "TESTS.md"), re.MULTILINE
        )
        require(
            Counter(registered) == Counter(f"{prefix}{number:02}" for number in range(1, size + 1)),
            f"System {prefix} case inventory mismatch",
        )
    decisions = re.findall(r"^## (D\d{2}) —", text(PACKAGE / "DECISIONS.md"), re.MULTILINE)
    require(
        Counter(decisions) == Counter(f"D{number:02}" for number in range(1, 18)),
        "Gap register must contain D01-D17 once",
    )
    packets = re.findall(r"^\| (E\d{2}) \|", text(PACKAGE / "EXECUTION.md"), re.MULTILINE)
    require(
        Counter(packets) == Counter(f"E{number:02}" for number in range(1, 23)),
        "Execution packet inventory mismatch",
    )
    children = [BACKEND_DESIGN / "plan" / name for name in OWNING_CHILDREN]
    for directory in (PACKAGE, SHARED, *children):
        for name in ("PLAN", "REQUIREMENTS", "DESIGN", "TESTS", "CHECKLIST", "VERIFICATION"):
            require((directory / f"{name}.md").is_file(), f"Missing {directory.name}/{name}.md")
    print(
        "PASS: 18 M02 responsibility gates, 26 acceptance cases, 14 races, 17 decisions, 22 packets"
    )


def check_links() -> None:
    authored = sorted(PACKAGE.glob("*.md")) + sorted(SHARED.glob("*.md"))
    for name in OWNING_CHILDREN:
        authored.extend(sorted((BACKEND_DESIGN / "plan" / name).glob("*.md")))
    linked = authored + [
        BACKEND_DESIGN / "GENERAL_PLAN.md",
        BACKEND_DESIGN / "GENERAL_CHECKLIST.md",
        ROOT / "openwiki/frontend-design/GENERAL_PLAN.md",
        ROOT / "openwiki/frontend-design/GENERAL_CHECKLIST.md",
        ROOT / "openwiki/database-design/README.md",
        ROOT / "AGENTS.md",
        ROOT / "backend/AGENTS.md",
        ROOT / "ui/AGENTS.md",
        ROOT / "backend/README.md",
        ROOT / "ui/README.md",
    ]
    count = 0
    for path in linked:
        content = text(path)
        for target in re.findall(r"(?<!!)\[[^\]\n]+\]\(([^)\n]+)\)", content):
            uri = urlsplit(target)
            if uri.scheme or uri.netloc or not uri.path:
                continue
            resolved = (path.parent / unquote(uri.path)).resolve()
            require(resolved.is_relative_to(ROOT), f"Link escapes repo: {path.name}: {target}")
            require(resolved.exists(), f"Broken link: {path.relative_to(ROOT)}: {target}")
            count += 1
        if path in authored:
            require(
                not any(line != line.rstrip() for line in content.splitlines()),
                f"Trailing whitespace: {path.relative_to(ROOT)}",
            )
    print(
        f"PASS: {len(authored)} package documents, {count} local link targets "
        f"across {len(linked)} documents"
    )


def main() -> None:
    source = json.loads(text(BACKEND_DESIGN / "API/openapi.json"))
    references = check_references(source, source)
    inventory = check_operations(source)
    check_transport(source)
    check_roadmap(inventory)
    check_frontend_roadmap()
    check_auth_baseline(source)
    check_storage_and_price_baseline(source)
    check_registers()
    check_links()
    print(f"PASS: {references} local OpenAPI references resolve")
    print("Planning consistency only; no application, database, provider or browser tests run.")


if __name__ == "__main__":
    main()
