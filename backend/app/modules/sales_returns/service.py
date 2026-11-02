from collections import defaultdict

from psycopg.errors import SerializationFailure
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.common.commands import internal_substep_key
from app.common.values import validate_number
from app.core.exceptions import ApiError
from app.modules.document_core.financial import FinancialDocumentService
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.document_core.service import exact_total
from app.modules.sales_returns.repository import SalesReturnRepository
from app.modules.sales_returns.rounding import cumulative_amounts


class SalesReturnService(FinancialDocumentService):
    repository = SalesReturnRepository
    kind = "SALES_RETURN"
    permission = "returns.prepare"
    operation = "listSalesReturns"

    def lock_origin(self, origin_id, permission):
        discovered = self.repo.origin(origin_id)
        identifiers = self.repo.agency_products(discovered["agencyId"])
        products = self.core.repo.lock_products(identifiers, active=False)
        self.inventory.lock_balances(products)
        agency = self.lock_agency(discovered["agencyId"], permission)
        self.settlement.repo.lock_history(agency["id"])
        self.authorize((permission,))
        if self.repo.agency_products(agency["id"]) != identifiers:
            raise DBAPIError(None, None, SerializationFailure("Return dependencies changed"))
        return self.repo.origin(origin_id), agency, products

    def check_return_date(self, origin, day):
        if day < origin["businessDate"]:
            raise ApiError(409, "RETURN_SOURCE_CONFLICT", "Return cannot precede original sale")

    def prepare_lines(self, origin, lines, products, day):
        self.check_return_date(origin, day)
        sold = {
            line["productId"]: line for line in self.core.repo.lines(origin["currentRevisionId"])
        }
        values = []
        for number, body in enumerate(lines, 1):
            source = self.repo.origin_line(origin["id"], int(body.originLineId))
            current = sold.get(source["productId"])
            if current is None or (current["unitId"], current["unitPrice"]) != (
                source["unitId"],
                source["unitPrice"],
            ):
                raise ApiError(
                    409, "RETURN_SOURCE_CONFLICT", "Original line differs from the current sale"
                )
            product = products[source["productId"]]
            if not product["allowsFraction"] and body.quantity != body.quantity.to_integral_value():
                raise ApiError(409, "INVALID_QUANTITY", "Unit requires an integer return quantity")
            if any(line["productId"] == source["productId"] for line in values):
                raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has a return line")
            values.append(
                {
                    "productId": source["productId"],
                    "unitId": source["unitId"],
                    "productName": source["productName"],
                    "unitName": source["unitName"],
                    "quantity": body.quantity,
                    "unitPrice": source["unitPrice"],
                    "basePurchasePrice": None,
                    "originLineId": source["id"],
                    "returnAmount": 0,
                    "id": -number,
                    "businessDate": day,
                    "businessOrder": 9223372036854775807,
                }
            )
        history = sorted(
            self.repo.history(origin["id"]) + values,
            key=lambda line: (line["businessDate"], line["businessOrder"], line["id"]),
        )
        amounts = cumulative_amounts(history, sold)
        return [
            {
                key: value
                for key, value in line.items()
                if key not in ("id", "businessDate", "businessOrder")
            }
            | {"returnAmount": amounts[line["id"]]}
            for line in values
        ]

    def create(self, body, key):
        def work(command):
            origin, agency, products = self.lock_origin(int(body.originDocumentId), self.permission)
            self.check_date(agency, body.businessDate)
            values = self.prepare_lines(origin, body.lines, products, body.businessDate)
            identifier = self.core.create_draft(
                self.kind,
                body.businessDate,
                internal_substep_key(command.id, "document"),
                agencyId=agency["id"],
                originDocumentId=origin["id"],
                note=body.note,
                totalAmount=exact_total(line["returnAmount"] for line in values),
            )
            revision_id = self.core.repo.document(identifier)["currentRevisionId"]
            for line in values:
                self.core.repo.put_line(revision_id, line)
            return lambda: self.result(
                identifier, status=201, location=f"/api/v1/sales-returns/{identifier}"
            )

        return self.command(
            "createSalesReturn", "sales-returns", key, body.model_dump(), self.permission, work
        )

    def lock_draft(self, identifier, condition, permission):
        source = self.source(identifier)
        origin, agency, products = self.lock_origin(source["originDocumentId"], permission)
        document, revision = self.core.repo.lock_current(identifier)
        self.authorize((permission,))
        condition.compare(self.etag(self.core.get(identifier, check_permission=False)))
        if document["status"] != "DRAFT" or revision["state"] != "DRAFT":
            raise ApiError(409, "STATE_CONFLICT", "Only a current return draft is editable")
        return document, revision, origin, agency, products

    def update(self, identifier, body, condition):
        def work():
            _, revision, origin, agency, _ = self.lock_draft(identifier, condition, self.permission)
            values = {name: getattr(body, name) for name in body.model_fields_set}
            day = values.get("businessDate", revision["businessDate"])
            self.check_return_date(origin, day)
            self.check_date(agency, day)
            self.session.execute(
                REVISION.update().where(REVISION.c.id == revision["id"]).values(**values)
            )
            return lambda: self.get(identifier)

        return self.write(work)

    def post_revision(self, identifier, revision_id, agency, key):
        self.session.execute(
            REVISION.update()
            .where(REVISION.c.id == revision_id)
            .values(
                state="POSTED",
                postedBy=self.actor_id,
                postedAt=text("clock_timestamp()"),
                **self.snapshot(agency),
            )
        )
        self.session.execute(
            DOCUMENT.update()
            .where(DOCUMENT.c.id == identifier)
            .values(status="POSTED", currentRevisionId=revision_id)
        )
        batch = self.core.repo.append_batch(revision_id, "POST", key, self.actor_id)
        document = self.core.repo.document(identifier)
        revision = self.settlement.repo.source(identifier)
        self.inventory.append(
            batch,
            self.core.repo.lines(revision_id),
            revision["businessDate"],
            document["businessOrder"],
        )

    def replace_rounding(self, identifier, amounts, command_id, agency):
        document, revision = self.core.repo.lock_current(identifier)
        lines = self.core.repo.lines(revision["id"])
        if all(line["returnAmount"] == amounts[line["id"]] for line in lines):
            return
        values = {
            name: revision[name]
            for name in ("note", "agencyName", "agencyAddress", "agencyPhone", "agencyEmail")
        }
        new_id = self.core.new_revision(
            identifier,
            revision["businessDate"],
            "Cumulative return rounding replay",
            totalAmount=exact_total(amounts[line["id"]] for line in lines),
            **values,
        )
        for line in lines:
            self.core.repo.put_line(
                new_id,
                {
                    name: line[name]
                    for name in (
                        "productId",
                        "unitId",
                        "productName",
                        "unitName",
                        "quantity",
                        "unitPrice",
                        "basePurchasePrice",
                        "originLineId",
                    )
                }
                | {"returnAmount": amounts[line["id"]]},
            )
        reverse = self.core.repo.append_batch(
            revision["id"],
            "REVERSE",
            internal_substep_key(command_id, f"return-reverse:{revision['id']}"),
            self.actor_id,
        )
        self.inventory.reverse_revision(revision["id"], reverse)
        for ledger in ("receivable", "credit"):
            for entry in self.settlement.repo.effective(revision["id"], ledger):
                self.settlement.repo.reverse(reverse, ledger, entry)
        historic_agency = {
            name: revision["agency" + name.title()]
            for name in ("name", "email", "address", "phone")
        }
        self.post_revision(
            identifier,
            new_id,
            historic_agency,
            internal_substep_key(command_id, f"return-replacement:{new_id}"),
        )

    def post(self, identifier, condition, key):
        def work(command):
            _, revision, origin, agency, products = self.lock_draft(
                identifier, condition, "returns.post"
            )
            self.check_return_date(origin, revision["businessDate"])
            lines = self.core.repo.lines(revision["id"])
            if not lines:
                raise ApiError(409, "EMPTY_DOCUMENT", "Return requires lines")
            current = {
                int(item.productId): item.currentStock
                for item in self.inventory.changes(line["productId"] for line in lines)
            }
            for line in lines:
                try:
                    validate_number(current[line["productId"]] + line["quantity"], kind="Quantity")
                except ValueError:
                    raise ApiError(
                        409, "STOCK_OVERFLOW", "Return exceeds the stored stock range"
                    ) from None
            self.session.execute(
                DOCUMENT.update().where(DOCUMENT.c.id == identifier).values(status="POSTED")
            )
            history = self.repo.history(origin["id"])
            sold = {
                line["productId"]: line
                for line in self.core.repo.lines(origin["currentRevisionId"])
            }
            amounts = cumulative_amounts(history, sold)
            for line in lines:
                self.core.repo.put_line(
                    revision["id"], {"returnAmount": amounts[line["id"]]}, line["id"]
                )
            self.core.repo.set_total(
                revision["id"], exact_total(amounts[line["id"]] for line in lines)
            )
            self.post_revision(
                identifier, revision["id"], agency, internal_substep_key(command.id, "post")
            )
            documents = defaultdict(list)
            for line in history:
                documents[line["document"]].append(line)
            for dependent in documents:
                if dependent != identifier:
                    self.replace_rounding(dependent, amounts, command.id, agency)
            self.settlement.replay(agency["id"], command.id, permission="returns.post")
            return lambda: self.result(identifier, products=[line["productId"] for line in lines])

        return self.command(
            "postSalesReturn", f"sales-return:{identifier}", key, {}, "returns.post", work
        )

    def cancel_draft(self, identifier, reason, condition, key):
        def work(command):
            self.lock_draft(identifier, condition, "documents.cancel")
            self.session.execute(
                DOCUMENT.update()
                .where(DOCUMENT.c.id == identifier)
                .values(
                    status="CANCELLED",
                    cancelledBy=self.actor_id,
                    cancelledAt=text("clock_timestamp()"),
                    cancelReason=reason.reason,
                )
            )
            return lambda: self.result(identifier)

        return self.command(
            "cancelSalesReturn",
            f"sales-return:{identifier}",
            key,
            reason.model_dump(),
            "documents.cancel",
            work,
        )
