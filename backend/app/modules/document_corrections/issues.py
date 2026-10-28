from psycopg.errors import SerializationFailure
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.common.commands import CommandRepository, CommandScope, internal_substep_key
from app.common.dates import vietnam_date
from app.common.prices import stored_selling_price
from app.common.values import rounded_amount, validate_number
from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.core.transactions import TransactionRunner
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.document_core.schemas import DraftLine
from app.modules.document_core.service import exact_total
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.sales_returns.repository import SalesReturnRepository
from app.modules.sales_returns.rounding import cumulative_amounts


class IssueCorrectionService:
    def __init__(self, owner):
        self.owner = owner
        self.session, self.core = owner.session, owner.core
        self.inventory, self.settlement = owner.inventory, owner.settlement

    def evidence(self, identifier):
        return [
            dict(row)
            for row in self.session.execute(
                text("""
            SELECT u.* FROM dms.upfront_confirmation u JOIN dms.document_revision r
            ON r.id=u."issueRevisionId" WHERE r."documentId"=:id
            AND u.state IN ('VERIFIED','CONSUMED') ORDER BY u.id
            """),
                {"id": identifier},
            ).mappings()
        ]

    def run(self, identifier, body, condition, key, *, correcting):
        permission = "documents.correct" if correcting else "documents.cancel"
        required = (permission, "stock.issue.post") if correcting else (permission,)
        scope = CommandScope(
            self.owner.actor_id,
            "correctStockIssue" if correcting else "cancelStockIssue",
            f"stock-issue:{identifier}",
            key,
        )
        separation_required = False

        def authorize():
            nonlocal separation_required
            self.owner.authorize(required)
            if not correcting:
                saved = CommandRepository(self.session).find(scope)
                separated = (
                    saved is not None
                    and saved.result is not None
                    and saved.result["body"].get("separateReceiptId") is not None
                )
                separation_required = (
                    separation_required or separated or bool(self.evidence(identifier))
                )
                if separation_required:
                    self.owner.authorize(("cash.receipt.post",))
            set_audit_context(
                self.session, self.owner.actor_id, self.owner.request_id, function_code=permission
            )

        def work(command):
            source = self.owner.source(identifier)
            discovered = self.core.repo.product_ids(identifier)
            ids = set(discovered)
            if correcting:
                ids.update(int(line.productId) for line in body.lines)
            products = self.core.repo.lock_products(ids, active=False)
            self.inventory.lock_balances(ids)
            agency = self.settlement.repo.lock_agency(source["agencyId"])
            self.settlement.repo.lock_history(agency["id"])
            document, revision = self.core.repo.lock_current(identifier)
            if self.core.repo.product_ids(identifier) != discovered:
                raise DBAPIError(None, None, SerializationFailure("Issue dependencies changed"))
            authorize()
            condition.compare(self.owner.etag(self.core.get(identifier, check_permission=False)))
            expected = ("POSTED",) if correcting else ("DRAFT", "PENDING", "POSTED")
            if document["status"] not in expected:
                raise ApiError(409, "STATE_CONFLICT", "Issue state does not allow this action")
            if correcting:
                self.replace(document, revision, body, products, agency, command.id)
                separate = None
            else:
                if SalesReturnRepository(self.session).history(identifier):
                    raise ApiError(
                        409,
                        "RETURN_SOURCE_CONFLICT",
                        "Effective returns prevent issue cancellation",
                    )
                separate = self.separate_money(identifier, body.reason, agency, command.id)
                if document["status"] == "POSTED":
                    self.reverse(revision["id"], command.id, "issue", inventory=True)
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
            self.check_stock(ids)
            self.settlement.replay(agency["id"], command.id, permission=permission)
            authorize()

            def project():
                current = self.core.get(identifier, check_permission=False)
                result = self.owner.result(
                    identifier,
                    status=201 if correcting else 200,
                    products=ids if document["status"] == "POSTED" else (),
                    location=f"/api/v1/documents/{identifier}/revisions/{current.currentRevision.revisionNo}"
                    if correcting
                    else None,
                )
                result.body["separateReceiptId"] = None if separate is None else str(separate)
                return result

            return project

        return TransactionRunner(self.session).run(
            scope,
            body.model_dump(exclude_none=True),
            authorize=authorize,
            work=work,
            conflicts={
                ("23514", None): ("CORRECTION_CONFLICT", "Issue correction violates history"),
                ("22003", None): ("BALANCE_OVERFLOW", "Issue correction exceeds stored range"),
            },
        )

    def lines(self, revision, body, products):
        old = {
            line["productId"]: line
            for line in self.session.execute(
                text("""SELECT DISTINCT ON (l."productId") l.*
                FROM dms.document_line l JOIN dms.document_revision r ON r.id=l."revisionId"
                WHERE r."documentId"=:document AND r.state='POSTED'
                ORDER BY l."productId",r."revisionNo" DESC"""),
                {"document": revision["documentId"]},
            ).mappings()
        }
        rate = (
            body.sellingPriceRate
            if body.sellingPriceRate is not None
            else revision["sellingPriceRate"]
        )
        values = []
        for line in body.lines:
            identifier = int(line.productId)
            if any(value["productId"] == identifier for value in values):
                raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has a line")
            product, original = products[identifier], old.get(identifier)
            base = line.basePurchasePrice
            if base is None:
                base = (
                    original["basePurchasePrice"]
                    if original is not None
                    else self.session.scalar(
                        text(
                            'SELECT "currentPurchasePrice" FROM dms.inventory_balance '
                            'WHERE "productId"=:id'
                        ),
                        {"id": identifier},
                    )
                )
            if base <= 0:
                raise ApiError(
                    409, "PRICE_SOURCE_REQUIRED", "Product requires a valid purchase price"
                )
            price = stored_selling_price(rounded_amount(base, rate))
            prepared = DraftLine(
                kind="STOCK_ISSUE",
                productId=str(identifier),
                quantity=line.quantity,
                unitPrice=price,
                basePurchasePrice=base,
            )
            if original is None:
                value = self.core.line_values("STOCK_ISSUE", prepared, product)
            else:
                if (
                    not product["allowsFraction"]
                    and line.quantity != line.quantity.to_integral_value()
                ):
                    raise ApiError(409, "INVALID_QUANTITY", "Unit requires integer quantity")
                value = {
                    **prepared.model_dump(exclude={"kind"}),
                    "productId": identifier,
                    **{name: original[name] for name in ("unitId", "productName", "unitName")},
                }
            value.update(
                quantity=prepared.quantity,
                unitPrice=prepared.unitPrice,
                basePurchasePrice=prepared.basePurchasePrice,
            )
            values.append(value)
        return values, rate

    def replace(self, document, revision, body, products, agency, command_id):
        self.owner.check_date(agency, body.businessDate)
        lines, rate = self.lines(revision, body, products)
        total = exact_total(rounded_amount(line["quantity"], line["unitPrice"]) for line in lines)
        if total <= 0 or total < revision["immediatePayment"]:
            raise ApiError(409, "INVALID_TOTAL", "Replacement cannot remove received upfront money")
        history = SalesReturnRepository(self.session).history(document["id"])
        if any(line["businessDate"] < body.businessDate for line in history):
            raise ApiError(409, "RETURN_SOURCE_CONFLICT", "Issue cannot follow an effective return")
        cumulative_amounts(history, {line["productId"]: line for line in lines})
        new_id = self.core.new_revision(
            document["id"],
            body.businessDate,
            body.reason,
            totalAmount=total,
            immediatePayment=revision["immediatePayment"],
            sellingPriceRate=rate,
            maxDebtSnapshot=revision["maxDebtSnapshot"],
            note=body.note,
            **{
                name: revision[name]
                for name in ("agencyName", "agencyAddress", "agencyPhone", "agencyEmail")
            },
        )
        for line in lines:
            self.core.repo.put_line(new_id, line)
        self.reverse(revision["id"], command_id, "issue", inventory=True)
        self.session.execute(
            REVISION.update()
            .where(REVISION.c.id == new_id)
            .values(state="READY", readyBy=self.owner.actor_id, readyAt=text("clock_timestamp()"))
        )
        self.session.execute(
            REVISION.update()
            .where(REVISION.c.id == new_id)
            .values(
                state="POSTED", postedBy=self.owner.actor_id, postedAt=text("clock_timestamp()")
            )
        )
        self.session.execute(
            DOCUMENT.update()
            .where(DOCUMENT.c.id == document["id"])
            .values(currentRevisionId=new_id)
        )
        batch = self.core.repo.append_batch(
            new_id,
            "POST",
            internal_substep_key(command_id, "issue-replacement"),
            self.owner.actor_id,
        )
        self.inventory.append(
            batch,
            self.core.repo.lines(new_id),
            body.businessDate,
            document["businessOrder"],
            direction=-1,
        )
        if revision["businessDate"] != body.businessDate:
            for evidence in self.evidence(document["id"]):
                if evidence["state"] == "CONSUMED":
                    self.sync_auto(
                        evidence["receiptDocumentId"], body.businessDate, body.reason, command_id
                    )

    def reverse(self, revision_id, key, label, *, inventory=False):
        batch = self.core.repo.append_batch(
            revision_id,
            "REVERSE",
            internal_substep_key(key, f"{label}-reverse:{revision_id}"),
            self.owner.actor_id,
        )
        if inventory:
            self.inventory.reverse_revision(revision_id, batch)
        for ledger in ("receivable", "credit"):
            for entry in self.settlement.repo.effective(revision_id, ledger):
                self.settlement.repo.reverse(batch, ledger, entry)

    def sync_auto(self, identifier, day, reason, key):
        _, old = self.core.repo.lock_current(identifier)
        new = self.core.new_revision(
            identifier,
            day,
            reason,
            **{
                name: old[name]
                for name in (
                    "totalAmount",
                    "paymentMethod",
                    "agencyName",
                    "agencyAddress",
                    "agencyPhone",
                    "agencyEmail",
                    "note",
                )
            },
        )
        self.reverse(old["id"], key, "auto")
        self.session.execute(
            REVISION.update()
            .where(REVISION.c.id == new)
            .values(
                state="POSTED", postedBy=self.owner.actor_id, postedAt=text("clock_timestamp()")
            )
        )
        self.session.execute(
            DOCUMENT.update().where(DOCUMENT.c.id == identifier).values(currentRevisionId=new)
        )
        self.core.repo.append_batch(
            new, "POST", internal_substep_key(key, f"auto-post:{new}"), self.owner.actor_id
        )

    def separate_money(self, identifier, reason, agency, key):
        separate = None
        for evidence in self.evidence(identifier):
            self.owner.authorize(("cash.receipt.post",))
            if evidence["state"] == "CONSUMED":
                auto, revision = self.core.repo.lock_current(evidence["receiptDocumentId"])
                self.reverse(revision["id"], key, "auto")
                self.session.execute(
                    DOCUMENT.update()
                    .where(DOCUMENT.c.id == auto["id"])
                    .values(
                        status="CANCELLED",
                        cancelledBy=self.owner.actor_id,
                        cancelledAt=text("clock_timestamp()"),
                        cancelReason=reason,
                    )
                )
            receipts = PaymentReceiptService(
                self.session,
                self.owner.codec,
                self.owner.actor_id,
                self.owner.request_id,
                self.owner.authorize,
            )
            separate = receipts.create_internal(
                agency,
                vietnam_date(evidence["receivedAt"]),
                evidence["amount"],
                evidence["method"],
                internal_substep_key(key, f"separate:{evidence['id']}"),
                receipt_type="RECEIVED_UNAPPLIED",
                origin=identifier,
                note=reason,
            )
            self.session.execute(
                text(
                    "UPDATE dms.upfront_confirmation SET state='RECEIVED_SEPARATELY',"
                    '"receiptDocumentId"=:receipt WHERE id=:id'
                ),
                {"receipt": separate, "id": evidence["id"]},
            )
            # Post structure only; final replay runs after canceling the original issue.
            _, draft = self.core.repo.lock_current(separate)
            self.session.execute(
                REVISION.update()
                .where(REVISION.c.id == draft["id"])
                .values(
                    state="POSTED",
                    postedBy=self.owner.actor_id,
                    postedAt=text("clock_timestamp()"),
                    **receipts.snapshot(agency),
                )
            )
            self.session.execute(
                DOCUMENT.update().where(DOCUMENT.c.id == separate).values(status="POSTED")
            )
            self.core.repo.append_batch(
                draft["id"],
                "POST",
                internal_substep_key(key, f"separate-post:{separate}"),
                self.owner.actor_id,
            )
        return separate

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
