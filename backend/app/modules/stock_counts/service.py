from datetime import datetime

from psycopg.errors import SerializationFailure
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.common.commands import CommandResult, CommandScope, internal_substep_key
from app.common.dates import vietnam_date
from app.common.pagination import build_page
from app.common.preconditions import canonical_etag
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.modules.stock_adjustments.schemas import StockAdjustmentCreate
from app.modules.stock_adjustments.service import StockAdjustmentService
from app.modules.stock_counts.repository import StockCountRepository
from app.modules.stock_counts.schemas import (
    CountLineList,
    StockCount,
    StockCountLine,
    StockCountList,
)
from app.modules.stock_receipts.service import StockReceiptService


class StockCountService(StockReceiptService):
    repository = StockCountRepository
    permission = "stock.count"

    def project_line(self, row):
        values = {
            key: value
            for key, value in row.items()
            if key not in ("countId", "observedLastEntryId")
        }
        for key in ("id", "productId"):
            values[key] = str(values[key])
        return StockCountLine.model_validate(values)

    def get(self, identifier):
        row = self.repo.header(identifier)
        self.authorize((self.permission,))
        row["lines"] = [self.project_line(line) for line in self.repo.lines(identifier)]
        for key in ("id", "createdBy", "confirmedBy", "adjustmentDocumentId"):
            if row[key] is not None:
                row[key] = str(row[key])
        return StockCount.model_validate(row)

    def etag(self, item):
        return canonical_etag(
            f"stock-count:{item.id}",
            {
                "detail": item.model_dump(mode="json"),
                "observations": [
                    (line["id"], line["observedLastEntryId"])
                    for line in self.repo.lines(int(item.id))
                ],
            },
        )

    def get_line(self, identifier, line_id):
        item = self.get(identifier)
        for line in item.lines:
            if int(line.id) == line_id:
                return line
        raise ApiError(404, "NOT_FOUND", "Count line not found")

    def result(self, identifier, *, status=200, line_id=None):
        item = self.get(identifier)
        headers = {"ETag": self.etag(item)}
        body = item if line_id is None else self.get_line(identifier, line_id)
        if status == 201:
            headers["Location"] = f"/api/v1/stock-counts/{identifier}" + (
                "" if line_id is None else f"/lines/{line_id}"
            )
        return CommandResult(status=status, body=body.model_dump(mode="json"), headers=headers)

    def command(self, operation, scope, key, payload, permission, work):
        def authorize():
            set_audit_context(
                self.session, self.actor_id, self.request_id, function_code=self.permission
            )
            self.authorize((self.permission,))
            if operation == "confirmStockCount":
                identifier = int(scope.split(":")[1])
                if any(line["difference"] for line in self.repo.lines(identifier)):
                    self.authorize(("stock.adjustment.post",))

        return TransactionRunner(self.session).run(
            CommandScope(self.actor_id, operation, scope, key),
            payload,
            authorize=authorize,
            work=work,
        )

    def validate_quantity(self, product, quantity):
        if not product["allowsFraction"] and quantity != quantity.to_integral_value():
            raise ApiError(409, "INVALID_QUANTITY", "Unit requires an integer count")

    def lock(self, identifier, condition, *, extra=()):
        discovered = self.repo.product_ids(identifier)
        products = self.core.repo.lock_products(set(discovered) | set(extra), active=False)
        self.inventory.lock_balances(products)
        row = self.repo.header(identifier, lock=True)
        self.authorize((self.permission,))
        if self.repo.product_ids(identifier) != discovered:
            raise DBAPIError(None, None, SerializationFailure("Count products changed"))
        condition.compare(self.etag(self.get(identifier)))
        if row["state"] != "DRAFT":
            raise ApiError(409, "STATE_CONFLICT", "Confirmed count is immutable")
        return row, products

    def create(self, body, key):
        def work(command):
            identifiers = [int(line.productId) for line in body.lines]
            if len(set(identifiers)) != len(identifiers):
                raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has an observation")
            products = self.core.repo.lock_products(identifiers, active=False)
            self.inventory.lock_balances(products)
            self.authorize((self.permission,))
            identifier = self.repo.create(body, self.actor_id)
            for line in body.lines:
                product = products[int(line.productId)]
                self.validate_quantity(product, line.countedQuantity)
                self.repo.put_line(identifier, product, line.countedQuantity)
            return lambda: self.result(identifier, status=201)

        return self.command(
            "createStockCount", "stock-counts", key, body.model_dump(), self.permission, work
        )

    def update(self, identifier, body, condition):
        def work():
            self.lock(identifier, condition)
            self.repo.update(identifier, body.model_dump(exclude_unset=True))
            return lambda: self.get(identifier)

        return self.write(work)

    def create_line(self, identifier, body, condition, key):
        def work(command):
            _, products = self.lock(identifier, condition, extra=(int(body.productId),))
            if int(body.productId) in self.repo.product_ids(identifier):
                raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has an observation")
            product = products[int(body.productId)]
            self.validate_quantity(product, body.countedQuantity)
            line_id = self.repo.put_line(identifier, product, body.countedQuantity)
            return lambda: self.result(identifier, status=201, line_id=line_id)

        return self.command(
            "createStockCountLine",
            f"stock-count:{identifier}",
            key,
            body.model_dump(),
            self.permission,
            work,
        )

    def update_line(self, identifier, line_id, body, condition):
        def work():
            _, products = self.lock(identifier, condition)
            line = self.get_line(identifier, line_id)
            product = products[int(line.productId)]
            self.validate_quantity(product, body.countedQuantity)
            self.repo.put_line(
                identifier, product, body.countedQuantity, line_id=line_id, refresh=False
            )
            return lambda: self.result(identifier, line_id=line_id)

        return self.write(work)

    def recount(self, identifier, body, condition, key):
        def work(command):
            _, products = self.lock(identifier, condition)
            inputs = {int(line.productId): line.countedQuantity for line in body.lines}
            if len(inputs) != len(body.lines) or set(inputs) != set(products):
                raise ApiError(
                    409, "RECOUNT_PRODUCTS", "Recount requires every existing product exactly once"
                )
            for line in self.repo.lines(identifier):
                product = products[line["productId"]]
                self.validate_quantity(product, inputs[product["id"]])
                self.repo.put_line(identifier, product, inputs[product["id"]], line_id=line["id"])
            self.repo.update(identifier, {"countedAt": body.countedAt, "reason": body.reason})
            return lambda: self.result(identifier)

        return self.command(
            "recountStock",
            f"stock-count:{identifier}",
            key,
            body.model_dump(),
            self.permission,
            work,
        )

    def confirm(self, identifier, condition, key):
        def work(command):
            row, products = self.lock(identifier, condition)
            lines = self.repo.lines(identifier)
            if not lines:
                raise ApiError(409, "EMPTY_COUNT", "Count requires observations")
            for line in lines:
                observed = self.repo.observation(line["productId"])
                if (line["bookQuantity"], line["observedLastEntryId"]) != (
                    observed.currentStock,
                    observed.last,
                ):
                    raise ApiError(
                        409,
                        "STALE_STOCK_SNAPSHOT",
                        "Stock changed since observation; recount required",
                    )
            differences = [line for line in lines if line["difference"]]
            adjustment_id = None
            if differences:
                self.authorize(("stock.adjustment.post",))
                if not row["reason"] or not row["reason"].strip():
                    raise ApiError(409, "REASON_REQUIRED", "Count differences require a reason")
                adjustments = StockAdjustmentService(
                    self.session, self.codec, self.actor_id, self.request_id, self.authorize
                )
                body = StockAdjustmentCreate(
                    businessDate=vietnam_date(row["countedAt"]),
                    reason=row["reason"],
                    lines=[
                        {"productId": str(line["productId"]), "quantity": line["difference"]}
                        for line in differences
                    ],
                )
                adjustment_id = adjustments.create_internal(
                    body, internal_substep_key(command.id, "adjustment"), products
                )
            self.repo.update(
                identifier,
                {
                    "state": "CONFIRMED",
                    "confirmedBy": self.actor_id,
                    "confirmedAt": self.session.scalar(text("SELECT clock_timestamp()")),
                    "adjustmentDocumentId": adjustment_id,
                },
            )
            if adjustment_id is not None:
                adjustments.post_internal(adjustment_id, internal_substep_key(command.id, "post"))
            return lambda: self.result(identifier)

        return self.command(
            "confirmStockCount", f"stock-count:{identifier}", key, {}, self.permission, work
        )

    def list(
        self,
        *,
        limit=25,
        cursor=None,
        code=None,
        state=None,
        productId=None,
        countedFrom=None,
        countedTo=None,
        sort="-countedAt",
    ):
        self.authorize((self.permission,))
        if countedFrom is not None and countedTo is not None and countedFrom >= countedTo:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid count interval")
        if sort not in ("id", "-id", "countedAt", "-countedAt"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid count sort")
        scope = {
            "operation": "listStockCounts",
            "code": code,
            "state": state,
            "productId": productId,
            "countedFrom": countedFrom,
            "countedTo": countedTo,
            "sort": sort,
        }
        keys = (None, None) if cursor is None else self.codec.decode(cursor, scope, [datetime, int])
        descending = sort.startswith("-")
        field = "id" if sort.removeprefix("-") == "id" else '"countedAt",id'
        comparison = "<" if descending else ">"
        direction = "DESC" if descending else "ASC"
        base = str(self.repo.listing())
        boundary = (
            "id " + comparison + " CAST(:anchor AS bigint)"
            if field == "id"
            else '("countedAt",id) '
            + comparison
            + " (CAST(:day AS timestamptz),CAST(:anchor AS bigint))"
        )
        order = (
            "id " + direction if field == "id" else '"countedAt" ' + direction + ",id " + direction
        )
        rows = self.session.execute(
            text(
                base
                + f" AND (CAST(:anchor AS bigint) IS NULL OR {boundary})"
                + f" ORDER BY {order} LIMIT :fetch"
            ),
            {
                "code": code,
                "state": state,
                "product": productId,
                "start": countedFrom,
                "end": countedTo,
                "anchor": keys[1],
                "day": keys[0],
                "fetch": limit + 1,
            },
        ).mappings()
        items, pagination = build_page(
            [self.get(row["id"]) for row in rows],
            limit,
            self.codec,
            scope,
            lambda item: [item.countedAt, int(item.id)],
        )
        return StockCountList(items=items, pagination=pagination)

    def lines(
        self, identifier, *, limit=25, cursor=None, productId=None, hasDifference=None, sort="id"
    ):
        item = self.get(identifier)
        if sort not in ("id", "-id"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid count-line sort")
        scope = {
            "operation": "listStockCountLines",
            "parent": identifier,
            "productId": productId,
            "hasDifference": hasDifference,
            "sort": sort,
        }
        anchor = None if cursor is None else self.codec.decode(cursor, scope, [int])[0]
        rows = [
            line
            for line in item.lines
            if (productId is None or line.productId == productId)
            and (hasDifference is None or bool(line.difference) == hasDifference)
            and (
                anchor is None
                or (int(line.id) < anchor if sort.startswith("-") else int(line.id) > anchor)
            )
        ]
        items, pagination = build_page(
            sorted(rows, key=lambda line: int(line.id), reverse=sort.startswith("-")),
            limit,
            self.codec,
            scope,
            lambda line: [int(line.id)],
        )
        return CountLineList(items=items, pagination=pagination)
