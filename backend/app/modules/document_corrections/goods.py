from psycopg.errors import SerializationFailure
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.common.commands import CommandScope, internal_substep_key
from app.common.values import validate_number
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.document_core.schemas import DraftLine
from app.modules.document_core.service import exact_total, line_amount


class GoodsCorrectionService:
    """Internal M29 slice; owning receipt/adjustment workflows supply result projection."""

    def __init__(self, owner, kind):
        if kind not in ("STOCK_RECEIPT", "STOCK_ADJUSTMENT"):
            raise ValueError("Unsupported goods correction kind")
        self.owner, self.kind = owner, kind
        self.session, self.core, self.inventory = owner.session, owner.core, owner.inventory
        self.suffix = "StockReceipt" if kind == "STOCK_RECEIPT" else "StockAdjustment"
        self.post_permission = (
            "stock.receipt.post" if kind == "STOCK_RECEIPT" else "stock.adjustment.post"
        )

    def command(self, identifier, body, condition, key, *, correcting):
        permission = "documents.correct" if correcting else "documents.cancel"
        required = (permission, self.post_permission) if correcting else (permission,)

        def authorize():
            self.owner.authorize(required)
            set_audit_context(
                self.session, self.owner.actor_id, self.owner.request_id, function_code=permission
            )

        def work(command):
            discovered = self.core.repo.product_ids(identifier)
            replacements = {int(line.productId) for line in body.lines} if correcting else set()
            identifiers = set(discovered) | replacements
            products = self.core.repo.lock_products(identifiers, active=False)
            self.inventory.lock_balances(identifiers)
            document, revision = self.core.repo.lock_current(identifier)
            authorize()
            if document["kind"] != self.kind:
                raise ApiError(404, "NOT_FOUND", "Document not found")
            if self.core.repo.product_ids(identifier) != discovered:
                raise DBAPIError(None, None, SerializationFailure("Document dependencies changed"))
            if self.kind == "STOCK_ADJUSTMENT":
                self.owner.independent(identifier)
            condition.compare(self.core.etag(self.core.get(identifier, check_permission=False)))
            allowed = ("POSTED",) if correcting else ("DRAFT", "POSTED")
            if document["status"] not in allowed or revision["state"] != document["status"]:
                raise ApiError(409, "STATE_CONFLICT", "Document state does not allow this action")
            if correcting:
                self.replace(document, revision, body, products, command.id)
            else:
                self.cancel(document, revision, body.reason, command.id)
            self.check_stock(identifiers)

            def project():
                current = self.core.get(identifier, check_permission=False)
                return self.owner.result(
                    identifier,
                    status=201 if correcting else 200,
                    products=identifiers if revision["state"] == "POSTED" else (),
                    location=(
                        f"/api/v1/documents/{identifier}/revisions/"
                        f"{current.currentRevision.revisionNo}"
                        if correcting
                        else None
                    ),
                )

            return project

        return TransactionRunner(self.session).run(
            CommandScope(
                self.owner.actor_id,
                ("correct" if correcting else "cancel") + self.suffix,
                f"{self.kind.lower().replace('_', '-')}:{identifier}",
                key,
            ),
            body.model_dump(),
            authorize=authorize,
            work=work,
            conflicts={
                ("23514", None): ("CORRECTION_CONFLICT", "Correction violates document history"),
                ("22003", None): ("BALANCE_OVERFLOW", "Correction exceeds stored balance range"),
            },
        )

    def replace(self, document, revision, body, products, command_id):
        identifiers = [int(line.productId) for line in body.lines]
        if len(set(identifiers)) != len(identifiers):
            raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has a line")
        old_lines = {line["productId"]: line for line in self.core.repo.lines(revision["id"])}
        values = []
        amounts = []
        for line in body.lines:
            prepared = DraftLine(
                kind=self.kind,
                **line.model_dump(),
                **({"unitPrice": "0"} if self.kind == "STOCK_ADJUSTMENT" else {}),
            )
            product_id = int(line.productId)
            old = old_lines.get(product_id)
            product = products[product_id]
            if old is None:
                value = self.core.line_values(self.kind, prepared, product)
            else:
                if (
                    not product["allowsFraction"]
                    and line.quantity != line.quantity.to_integral_value()
                ):
                    raise ApiError(409, "INVALID_QUANTITY", "Unit requires an integer quantity")
                # Existing historical goods retain recorded names/unit, even after retirement.
                value = {
                    **prepared.model_dump(exclude={"kind"}),
                    "productId": product_id,
                    "unitId": old["unitId"],
                    "productName": old["productName"],
                    "unitName": old["unitName"],
                }
            values.append(value)
            amounts.append(line_amount(prepared))
        total = exact_total(amounts)
        if self.kind == "STOCK_RECEIPT" and total <= 0:
            raise ApiError(409, "INVALID_TOTAL", "Posted receipt requires a positive total")
        successor = self.core.new_revision(
            document["id"], body.businessDate, body.reason, note=body.note, totalAmount=total
        )
        for value in values:
            self.core.repo.put_line(successor, value)
        self.reverse(revision["id"], command_id)
        self.session.execute(
            DOCUMENT.update()
            .where(DOCUMENT.c.id == document["id"])
            .values(currentRevisionId=successor)
        )
        self.session.execute(
            REVISION.update()
            .where(REVISION.c.id == successor)
            .values(
                state="POSTED", postedBy=self.owner.actor_id, postedAt=text("clock_timestamp()")
            )
        )
        batch = self.core.repo.append_batch(
            successor, "POST", internal_substep_key(command_id, "replacement"), self.owner.actor_id
        )
        self.inventory.append(
            batch, self.core.repo.lines(successor), body.businessDate, document["businessOrder"]
        )

    def reverse(self, revision_id, command_id):
        batch = self.core.repo.append_batch(
            revision_id, "REVERSE", internal_substep_key(command_id, "reverse"), self.owner.actor_id
        )
        self.inventory.reverse_revision(revision_id, batch)

    def cancel(self, document, revision, reason, command_id):
        if revision["state"] == "POSTED":
            self.reverse(revision["id"], command_id)
        self.session.execute(
            DOCUMENT.update()
            .where(DOCUMENT.c.id == document["id"])
            .values(
                status="CANCELLED",
                cancelledBy=self.owner.actor_id,
                cancelledAt=text("clock_timestamp()"),
                cancelReason=reason,
            )
        )

    def check_stock(self, identifiers):
        for identifier in sorted(identifiers):
            stock = self.session.execute(
                text("""
                WITH checkpoints AS (
                  SELECT "businessDate","businessOrder",sum(quantity) AS delta
                  FROM dms.inventory_entry WHERE "productId"=:id
                  GROUP BY "businessDate","businessOrder"
                ), history AS (
                  SELECT sum(delta) OVER(ORDER BY "businessDate","businessOrder") AS balance
                  FROM checkpoints
                ) SELECT coalesce(min(balance),0) AS minimum,
                  coalesce((SELECT sum(delta) FROM checkpoints),0) AS current FROM history
                """),
                {"id": identifier},
            ).one()
            if stock.minimum < 0:
                raise ApiError(409, "STOCK_CONFLICT", "Correction makes historical stock negative")
            try:
                validate_number(stock.current, kind="Quantity")
            except ValueError:
                raise ApiError(
                    409, "STOCK_OVERFLOW", "Correction exceeds stored stock range"
                ) from None

    def correct(self, identifier, body, condition, key):
        return self.command(identifier, body, condition, key, correcting=True)

    def cancel_document(self, identifier, body, condition, key):
        return self.command(identifier, body, condition, key, correcting=False)
