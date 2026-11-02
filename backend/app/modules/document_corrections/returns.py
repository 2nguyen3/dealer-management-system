from collections import defaultdict

from psycopg.errors import SerializationFailure
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.common.commands import CommandScope, internal_substep_key
from app.common.values import validate_number
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.document_core.service import exact_total
from app.modules.sales_returns.rounding import cumulative_amounts


class ReturnCorrectionService:
    def __init__(self, owner):
        self.owner, self.session = owner, owner.session
        self.core, self.inventory, self.settlement = owner.core, owner.inventory, owner.settlement

    def run(self, identifier, body, condition, key, *, correcting):
        permission = "documents.correct" if correcting else "documents.cancel"
        required = (permission, "returns.post") if correcting else (permission,)

        def authorize():
            self.owner.authorize(required)
            set_audit_context(
                self.session, self.owner.actor_id, self.owner.request_id, function_code=permission
            )

        def work(command):
            source = self.owner.source(identifier)
            discovered = self.owner.repo.agency_products(source["agencyId"])
            products = self.core.repo.lock_products(discovered, active=False)
            self.inventory.lock_balances(discovered)
            agency = self.settlement.repo.lock_agency(source["agencyId"])
            self.settlement.repo.lock_history(agency["id"])
            document, old = self.core.repo.lock_current(identifier)
            authorize()
            if self.owner.repo.agency_products(agency["id"]) != discovered:
                raise DBAPIError(None, None, SerializationFailure("Return dependencies changed"))
            condition.compare(self.owner.etag(self.core.get(identifier, check_permission=False)))
            if document["status"] not in (("POSTED",) if correcting else ("DRAFT", "POSTED")):
                raise ApiError(409, "STATE_CONFLICT", "Return state does not allow this action")
            if correcting:
                origin = self.owner.repo.origin(document["originDocumentId"])
                self.owner.check_date(agency, body.businessDate)
                self.owner.check_return_date(origin, body.businessDate)
                values = self.prepare(document, origin, body, products)
                new = self.core.new_revision(
                    identifier,
                    body.businessDate,
                    body.reason,
                    totalAmount=exact_total(line["returnAmount"] for line in values),
                    note=body.note,
                    **{
                        name: old[name]
                        for name in ("agencyName", "agencyAddress", "agencyPhone", "agencyEmail")
                    },
                )
                for line in values:
                    self.core.repo.put_line(new, line)
            if old["state"] == "POSTED":
                self.reverse(old["id"], command.id)
            if correcting:
                self.session.execute(
                    REVISION.update()
                    .where(REVISION.c.id == new)
                    .values(
                        state="POSTED",
                        postedBy=self.owner.actor_id,
                        postedAt=text("clock_timestamp()"),
                    )
                )
                self.session.execute(
                    DOCUMENT.update()
                    .where(DOCUMENT.c.id == identifier)
                    .values(currentRevisionId=new)
                )
                batch = self.core.repo.append_batch(
                    new,
                    "POST",
                    internal_substep_key(command.id, "replacement"),
                    self.owner.actor_id,
                )
                self.inventory.append(
                    batch, self.core.repo.lines(new), body.businessDate, document["businessOrder"]
                )
            else:
                self.session.execute(
                    DOCUMENT.update()
                    .where(DOCUMENT.c.id == identifier)
                    .values(
                        status="CANCELLED",
                        cancelledBy=self.owner.actor_id,
                        cancelledAt=text("clock_timestamp()"),
                        cancelReason=body.reason,
                    )
                )
            if old["state"] == "POSTED":
                self.replay_rounding(document["originDocumentId"], command.id, agency)
                self.settlement.replay(agency["id"], command.id, permission=permission)
                self.check_stock(discovered)
            authorize()

            def project():
                current = self.core.get(identifier, check_permission=False)
                return self.owner.result(
                    identifier,
                    status=201 if correcting else 200,
                    products=discovered if old["state"] == "POSTED" else (),
                    location=f"/api/v1/documents/{identifier}/revisions/{current.currentRevision.revisionNo}"
                    if correcting
                    else None,
                )

            return project

        return TransactionRunner(self.session).run(
            CommandScope(
                self.owner.actor_id,
                "correctSalesReturn" if correcting else "cancelSalesReturn",
                f"sales-return:{identifier}",
                key,
            ),
            body.model_dump(),
            authorize=authorize,
            work=work,
            conflicts={
                ("23514", None): ("CORRECTION_CONFLICT", "Correction violates return history"),
                ("22003", None): ("BALANCE_OVERFLOW", "Correction exceeds stored balance range"),
            },
        )

    def prepare(self, document, origin, body, products):
        values = []
        for number, line in enumerate(body.lines, 1):
            source = self.owner.repo.origin_line(origin["id"], int(line.originLineId))
            if any(value["productId"] == source["productId"] for value in values):
                raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has a line")
            product = products.get(source["productId"])
            if product is None:
                raise ApiError(409, "RETURN_SOURCE_CONFLICT", "Product is not in the current issue")
            if not product["allowsFraction"] and line.quantity != line.quantity.to_integral_value():
                raise ApiError(409, "INVALID_QUANTITY", "Unit requires integer quantity")
            values.append(
                {
                    **{
                        name: source[name]
                        for name in ("productId", "unitId", "productName", "unitName", "unitPrice")
                    },
                    "quantity": line.quantity,
                    "basePurchasePrice": None,
                    "originLineId": source["id"],
                    "id": -number,
                    "businessDate": body.businessDate,
                    "businessOrder": document["businessOrder"],
                }
            )
        history = [
            line
            for line in self.owner.repo.history(origin["id"])
            if line["document"] != document["id"]
        ]
        sold = {
            line["productId"]: line for line in self.core.repo.lines(origin["currentRevisionId"])
        }
        amounts = cumulative_amounts(
            sorted(
                history + values,
                key=lambda line: (line["businessDate"], line["businessOrder"], line["id"]),
            ),
            sold,
        )
        return [
            {
                name: value
                for name, value in line.items()
                if name not in ("id", "businessDate", "businessOrder")
            }
            | {"returnAmount": amounts[line["id"]]}
            for line in values
        ]

    def reverse(self, revision, key):
        batch = self.core.repo.append_batch(
            revision, "REVERSE", internal_substep_key(key, "return-reverse"), self.owner.actor_id
        )
        self.inventory.reverse_revision(revision, batch)
        for ledger in ("receivable", "credit"):
            for entry in self.settlement.repo.effective(revision, ledger):
                self.settlement.repo.reverse(batch, ledger, entry)

    def replay_rounding(self, origin_id, key, agency):
        history = self.owner.repo.history(origin_id)
        if not history:
            return
        origin = self.owner.repo.origin(origin_id)
        sold = {
            line["productId"]: line for line in self.core.repo.lines(origin["currentRevisionId"])
        }
        amounts = cumulative_amounts(history, sold)
        documents = defaultdict(list)
        for line in history:
            documents[line["document"]].append(line)
        for identifier in documents:
            self.owner.replace_rounding(identifier, amounts, key, agency)

    def check_stock(self, identifiers):
        for identifier in sorted(identifiers):
            row = self.session.execute(
                text("""
                WITH events AS (SELECT "businessDate","businessOrder",sum(quantity) AS delta
                  FROM dms.inventory_entry WHERE "productId"=:id
                  GROUP BY "businessDate","businessOrder"),
                balances AS (SELECT sum(delta) OVER(ORDER BY "businessDate","businessOrder")
                  AS balance FROM events)
                SELECT coalesce(min(balance),0),coalesce((SELECT sum(delta) FROM events),0)
                FROM balances
                """),
                {"id": identifier},
            ).one()
            if row[0] < 0:
                raise ApiError(409, "STOCK_CONFLICT", "Correction makes historical stock negative")
            try:
                validate_number(row[1], kind="Quantity")
            except ValueError:
                raise ApiError(
                    409, "STOCK_OVERFLOW", "Correction exceeds stored stock range"
                ) from None

    def correct(self, identifier, body, condition, key):
        return self.run(identifier, body, condition, key, correcting=True)

    def cancel(self, identifier, body, condition, key):
        return self.run(identifier, body, condition, key, correcting=False)
