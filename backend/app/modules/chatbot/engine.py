"""SemanticQueryEngine: validates a semantic query, checks per-metric permissions,
resolves agency/product names and reads exact figures. Pure Python over a repository;
it knows nothing about HTTP, MCP or the LLM."""

import re
import unicodedata
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.modules.chatbot.semantic_model import (
    METRIC_TEXT,
    PRODUCT_READERS,
    VARIANTS,
    Field,
    Variant,
    variant_for,
)

MAX_CANDIDATES = 10
MAX_ROWS = 50
OPS = {
    "eq": lambda a, b: a == b,
    "gt": lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "lt": lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
}


class ToolError(Exception):
    """Structured, LLM-readable failure (CONTRACT.md -> MCP tools)."""

    def __init__(self, code: str, message: str, **details):
        super().__init__(code)
        self.code = code
        self.message = message
        self.details = details

    def payload(self) -> dict:
        return {"error": self.code, "message": self.message, **self.details}


def normalize(value: str) -> str:
    """Accent/case-insensitive form: 'Đại lý Minh Phát' -> 'dai ly minh phat'."""
    value = value.replace("đ", "d").replace("Đ", "D")
    decomposed = unicodedata.normalize("NFD", value)
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", stripped).strip().lower()


def code_key(code: str) -> tuple[str, int]:
    prefix, _, number = code.partition("-")
    return (prefix, int(number)) if number.isdigit() else (code, 0)


def decimal_text(value) -> str:
    number = Decimal(str(value))
    if number == number.to_integral_value():
        return str(number.quantize(Decimal(1)))
    return format(number.normalize(), "f")


def match_entities(items: list[dict], query: str, entity: str) -> list[dict]:
    """Code match first, then names containing every word. Duplicate agency names stay
    ambiguous (QĐ16: pick by code); for other entities one exact name wins."""
    wanted = normalize(query)
    compact = wanted.replace(" ", "")
    if not wanted:
        return []
    for item in items:
        code = normalize(item["code"])
        if wanted == code or compact == code.replace("-", "").replace(" ", ""):
            return [item]
    words = wanted.split(" ")
    found = [item for item in items if all(word in normalize(item["name"]) for word in words)]
    exact = [item for item in found if normalize(item["name"]) == wanted]
    if len(exact) == 1 and len(found) > 1 and entity != "agency":
        return exact
    return found


class SemanticQueryEngine:
    """One caller's view: `allowed` is the live function-code set, `today` the business date."""

    def __init__(
        self,
        read: Callable[[], AbstractContextManager],
        allowed: frozenset[str],
        today: date,
        locale: str = "vi",
    ):
        self._read = read
        self.allowed = allowed
        self.today = today
        self.locale = "vi" if locale.startswith("vi") else "en"

    # -- discovery ---------------------------------------------------------------
    def permitted(self, variant: Variant) -> bool:
        return bool(self.allowed.intersection(variant.any_of))

    def describe(self) -> dict:
        metrics: dict[str, dict] = {}
        for variant in VARIANTS:
            if not self.permitted(variant):
                continue
            entry = metrics.setdefault(
                variant.metric, {"meaning": METRIC_TEXT[variant.metric], "shapes": []}
            )
            entry["shapes"].append(
                {
                    "period": "required" if variant.period else "omit for current balance",
                    "groupBy": variant.grain,
                    "filters": {
                        name: {"ops": list(field.ops), "value": field.label or field.kind}
                        for name, field in variant.fields.items()
                    },
                    "sorts": list(variant.sorts),
                    "columns": [key for key, _ in variant.columns],
                }
            )
        return {"today": self.today.isoformat(), "metrics": metrics}

    def find(self, entity: str, query: str) -> dict:
        if entity == "agency":
            if not self.allowed.intersection({"debt.read", "sales.read"}):
                raise ToolError("FORBIDDEN_METRIC", "No permission to look up agencies")
        elif not self.allowed.intersection(PRODUCT_READERS):
            raise ToolError("FORBIDDEN_METRIC", "No permission to look up products")
        with self._read() as repo:
            items = repo.agencies() if entity == "agency" else repo.products()
        found = match_entities(items, query, entity)
        return {
            "candidates": [self._candidate(entity, item) for item in found[:MAX_CANDIDATES]],
            "totalMatches": len(found),
        }

    @staticmethod
    def _candidate(entity: str, item: dict) -> dict:
        detail = item.get("wardName") if entity == "agency" else item.get("unitName")
        return {"code": item["code"], "name": item["name"], "detail": detail}

    # -- query ---------------------------------------------------------------------
    def query(self, raw: dict, select: dict | None = None) -> dict:
        """Runs a semantic query; `select` pins an entity by exact code (resume)."""
        if not isinstance(raw, dict):
            raise ToolError("UNSUPPORTED_QUERY", "Query must be an object")
        metric = raw.get("metric")
        if metric not in {"DEBT", "INVENTORY", "SALES"}:
            raise ToolError("UNSUPPORTED_QUERY", "Only DEBT, INVENTORY and SALES can be looked up")
        period = self._period(raw.get("period"), metric)
        group_by = raw.get("groupBy")
        variant = variant_for(metric, period is not None, group_by)
        if variant is None:
            raise ToolError(
                "UNSUPPORTED_FIELD", f"groupBy {group_by!r} is not available for {metric}"
            )
        if not self.permitted(variant):
            raise ToolError("FORBIDDEN_METRIC", f"No permission for {metric}")
        limit = raw.get("limit", 20)
        if type(limit) is not int or not 1 <= limit <= MAX_ROWS:
            raise ToolError("INVALID_VALUE", "limit must be an integer from 1 to 50")
        sort = raw.get("sort") or variant.default_sort
        if not isinstance(sort, str) or sort.removeprefix("-") not in variant.sorts:
            raise ToolError("UNSUPPORTED_FIELD", "Unsupported sort", allowed=list(variant.sorts))
        filters = raw.get("filters") or []
        if not isinstance(filters, list) or len(filters) > 5:
            raise ToolError("INVALID_VALUE", "filters must be a list of at most 5 items")

        with self._read() as repo:
            context = _Context(repo)
            ids, numeric, normalized = self._filters(variant, filters, select, context)
            rows, as_of = self._rows(variant, period, ids, context)
        for name, op, number in numeric:
            rows = [row for row in rows if OPS[op](Decimal(str(row[name])), number)]
        field = sort.removeprefix("-")
        if field.endswith("Code"):
            rows.sort(key=lambda row: code_key(row[field]), reverse=sort.startswith("-"))
        else:
            rows.sort(key=lambda row: code_key(row[variant.columns[0][0]]))
            rows.sort(key=lambda row: Decimal(str(row[field])), reverse=sort.startswith("-"))
        understood = {"metric": metric, "filters": normalized, "sort": sort, "limit": limit}
        if variant.metric == "SALES":
            understood["groupBy"] = variant.grain
        if period is not None:
            understood["period"] = {
                "fromDate": period[0].isoformat(),
                "toDate": period[1].isoformat(),
            }
        return {
            "title": variant.title[self.locale],
            "understood": understood,
            "columns": [{"key": key, "type": kind} for key, kind in variant.columns],
            "rows": [self._project(variant, row) for row in rows[:limit]],
            "totalRows": len(rows),
            "truncated": len(rows) > limit,
            "asOf": as_of.isoformat(),
            "source": self._source(variant, period, ids, sort),
        }

    def _period(self, value, metric: str) -> tuple[date, date] | None:
        if value in (None, {}):
            if metric == "SALES":
                raise ToolError(
                    "MISSING_FIELD", "SALES needs a period; ask the user", missing=["period"]
                )
            return None
        try:
            start = date.fromisoformat(value["fromDate"])
            end = date.fromisoformat(value["toDate"])
        except (TypeError, KeyError, ValueError):
            raise ToolError(
                "INVALID_VALUE", "period needs fromDate and toDate as YYYY-MM-DD"
            ) from None
        if start >= end:
            raise ToolError("INVALID_VALUE", "fromDate must be before toDate (half-open)")
        return start, end

    def _filters(self, variant, filters, select, context):
        ids: dict[str, int] = {}
        numeric: list[tuple[str, str, Decimal]] = []
        normalized: list[dict] = []
        entries = list(filters)
        if select is not None:
            entries = [
                f
                for f in entries
                if not (isinstance(f, dict) and f.get("field") == select["entity"])
            ]
            entries.append(
                {"field": select["entity"], "op": "eq", "value": select["code"], "_exact": True}
            )
        for entry in entries:
            if not isinstance(entry, dict):
                raise ToolError("INVALID_VALUE", "Each filter is {field, op, value}")
            name, op, value = entry.get("field"), entry.get("op"), entry.get("value")
            spec: Field | None = variant.fields.get(name) if isinstance(name, str) else None
            if spec is None:
                raise ToolError(
                    "UNSUPPORTED_FIELD",
                    f"Field {name!r} is not available here",
                    allowed=list(variant.fields),
                )
            if op not in spec.ops:
                raise ToolError("INVALID_OPERATOR", f"{name} supports {list(spec.ops)}")
            if not isinstance(value, str | int | float) or str(value).strip() == "":
                raise ToolError("INVALID_VALUE", f"{name} needs a value")
            text_value = str(value).strip()[:120]
            if spec.kind == "entity":
                item = context.resolve(spec.entity, text_value, exact=entry.get("_exact", False))
                ids[spec.entity] = int(item["id"])
                normalized.append({"field": name, "op": "eq", "value": item["code"]})
            else:
                try:
                    number = Decimal(text_value.replace(",", ""))
                except InvalidOperation:
                    raise ToolError("INVALID_VALUE", f"{name} needs a number") from None
                if not number.is_finite():
                    raise ToolError("INVALID_VALUE", f"{name} needs a number")
                numeric.append((name, op, number))
                normalized.append({"field": name, "op": op, "value": decimal_text(number)})
        return ids, numeric, normalized

    def _rows(self, variant, period, ids, context) -> tuple[list[dict], datetime]:
        repo = context.repo
        if variant.reader == "agency_debt":
            rows = [
                {
                    "agencyCode": a["code"],
                    "agencyName": a["name"],
                    "wardName": a["wardName"],
                    "debt": a["debt"],
                }
                for a in context.items("agency")
                if a["status"] == "ACTIVE"
                and ids.get("agency", a["id"]) == a["id"]
                and ids.get("ward", a["wardId"]) == a["wardId"]
                and ids.get("agencyType", a["typeId"]) == a["typeId"]
            ]
            return rows, repo.now()
        if variant.reader == "product_stock":
            rows = [
                {
                    "productCode": p["code"],
                    "productName": p["name"],
                    "unitName": p["unitName"],
                    "stock": p["stock"],
                }
                for p in context.items("product")
                if p["status"] == "ACTIVE" and ids.get("product", p["id"]) == p["id"]
            ]
            return rows, repo.now()
        filters = {
            "agencyId": ids.get("agency"),
            "productId": ids.get("product"),
            "typeId": ids.get("agencyType"),
            "wardId": ids.get("ward"),
        }
        allowed = {
            "debt": ("agencyId", "typeId", "wardId"),
            "inventory": ("productId",),
            "sales": ("agencyId", "typeId"),
            "product-sales": ("agencyId", "productId"),
        }[variant.reader]
        detached = repo.report(
            variant.reader,
            period[0],
            period[1],
            {key: filters[key] for key in allowed if filters[key] is not None},
        )
        return detached["rows"], detached["generatedAt"]

    @staticmethod
    def _project(variant, row: dict) -> dict:
        projected = {}
        for key, kind in variant.columns:
            value = row.get(key)
            if value is None:
                projected[key] = None
            elif kind in {"money", "quantity", "rate"}:
                projected[key] = decimal_text(value)
            elif kind == "integer":
                projected[key] = int(value)
            else:
                projected[key] = str(value)
        return projected

    @staticmethod
    def _source(variant, period, ids, sort) -> dict:
        query: dict[str, str] = {}
        if period is not None:
            query = {"fromDate": period[0].isoformat(), "toDate": period[1].isoformat()}
        names = {"agency": "agencyId", "product": "productId", "ward": "wardId"}
        names["agencyType"] = "typeId"
        for entity, value in ids.items():
            query[names[entity]] = str(value)
        return {"operationId": variant.source, "query": query}


class _Context:
    """Per-query cache of lookup lists inside one read transaction."""

    def __init__(self, repo):
        self.repo = repo
        self._cache: dict[str, list[dict]] = {}

    def items(self, entity: str) -> list[dict]:
        if entity not in self._cache:
            reader = {
                "agency": self.repo.agencies,
                "product": self.repo.products,
                "ward": self.repo.wards,
                "agencyType": self.repo.agency_types,
            }[entity]
            self._cache[entity] = reader()
        return self._cache[entity]

    def resolve(self, entity: str, value: str, *, exact: bool = False) -> dict:
        items = self.items(entity)
        if exact:
            found = [item for item in items if item["code"].lower() == value.lower()]
        else:
            found = match_entities(items, value, entity)
        if not found:
            raise ToolError("NO_MATCH", f"No {entity} matches {value!r}", entity=entity)
        if len(found) > 1:
            if entity in {"agency", "product"}:
                raise ToolError(
                    "AMBIGUOUS_ENTITY",
                    f"Several {entity} records match; the user must pick a code",
                    entity=entity,
                    totalMatches=len(found),
                    candidates=[
                        SemanticQueryEngine._candidate(entity, item)
                        for item in found[:MAX_CANDIDATES]
                    ],
                )
            raise ToolError(
                "INVALID_VALUE",
                f"Several {entity} values match {value!r}; use one of the names",
                options=[item["name"] for item in found[:MAX_CANDIDATES]],
            )
        return found[0]


def iterate_numbers(tables: list[dict]) -> Iterator[str]:
    for table in tables:
        for row in table["rows"]:
            for value in row.values():
                if value is not None:
                    yield str(value)
