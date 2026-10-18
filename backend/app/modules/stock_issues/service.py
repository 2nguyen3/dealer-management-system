from psycopg.errors import SerializationFailure
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.common.commands import internal_substep_key
from app.core.exceptions import ApiError
from app.modules.document_core.financial import FinancialDocumentService
from app.modules.document_core.models import DOCUMENT, REVISION
from app.modules.document_core.service import exact_total, line_amount
from app.modules.payment_receipts.service import PaymentReceiptService
from app.modules.stock_issues.repository import StockIssueRepository
from app.modules.upfront_payments.repository import UpfrontRepository


class StockIssueService(FinancialDocumentService):
    repository = StockIssueRepository
    kind = "STOCK_ISSUE"
    permission = "stock.issue.prepare"
    operation = "listStockIssues"

    def prepare_lines(self, lines, products):
        identifiers = [int(line.productId) for line in lines]
        if len(set(identifiers)) != len(identifiers):
            raise ApiError(409, "DUPLICATE_PRODUCT", "Product already has a line")
        prepared = [
            self.core.prepare_issue_line(int(line.productId), line.quantity) for line in lines
        ]
        values = [
            self.core.line_values(self.kind, line, products[int(line.productId)])
            for line in prepared
        ]
        return values, exact_total(line_amount(line) for line in prepared)

    def validate_agency(self, agency, day):
        self.check_date(agency, day)
        if agency["status"] != "ACTIVE":
            raise ApiError(409, "AGENCY_CONFLICT", "Issue requires an active agency")

    def validate_payment(self, immediate, total):
        if immediate > total:
            raise ApiError(409, "INVALID_TOTAL", "Immediate payment exceeds document total")

    def create(self, body, key):
        def work(command):
            products = self.core.repo.lock_products(int(line.productId) for line in body.lines)
            self.inventory.lock_balances(products)
            agency = self.lock_agency(int(body.agencyId), self.permission)
            self.validate_agency(agency, body.businessDate)
            values, total = self.prepare_lines(body.lines, products)
            self.validate_payment(body.immediatePayment, total)
            identifier = self.core.create_draft(
                self.kind,
                body.businessDate,
                internal_substep_key(command.id, "document"),
                agencyId=int(body.agencyId),
                totalAmount=total,
                immediatePayment=body.immediatePayment,
                note=body.note,
            )
            revision = self.core.repo.document(identifier)["currentRevisionId"]
            for line in values:
                self.core.repo.put_line(revision, line)
            return lambda: self.result(
                identifier, status=201, location=f"/api/v1/stock-issues/{identifier}"
            )

        return self.command(
            "createStockIssue", "stock-issues", key, body.model_dump(), self.permission, work
        )

    def lock(self, identifier, condition, permission, status, *, products=None):
        source = self.source(identifier)
        agency = self.lock_agency(source["agencyId"], permission)
        self.settlement.repo.lock_history(source["agencyId"])
        document, revision = self.core.repo.lock_current(identifier)
        self.authorize((permission,))
        if products is not None and tuple(sorted(products)) != self.core.repo.product_ids(
            identifier
        ):
            raise DBAPIError(None, None, SerializationFailure("Issue lines changed"))
        condition.compare(self.etag(self.core.get(identifier, check_permission=False)))
        if document["status"] != status:
            raise ApiError(409, "STATE_CONFLICT", f"Issue must be {status}")
        return document, revision, agency

    def update(self, identifier, body, condition):
        def work():
            _, revision, agency = self.lock(identifier, condition, self.permission, "DRAFT")
            values = {name: getattr(body, name) for name in body.model_fields_set}
            self.validate_agency(agency, values.get("businessDate", revision["businessDate"]))
            self.validate_payment(
                values.get("immediatePayment", revision["immediatePayment"]),
                revision["totalAmount"],
            )
            self.session.execute(
                REVISION.update().where(REVISION.c.id == revision["id"]).values(**values)
            )
            return lambda: self.get(identifier)

        return self.write(work)

    def submit(self, identifier, condition, key):
        def work(command):
            products = self.core.repo.lock_products(self.core.repo.product_ids(identifier))
            self.inventory.lock_balances(products)
            _, revision, agency = self.lock(
                identifier, condition, self.permission, "DRAFT", products=products
            )
            self.validate_agency(agency, revision["businessDate"])
            lines = self.core.repo.lines(revision["id"])
            if not lines:
                raise ApiError(409, "EMPTY_DOCUMENT", "Issue requires at least one line")
            prepared = []
            for line in lines:
                body = self.core.prepare_issue_line(line["productId"], line["quantity"])
                prepared.append((line, body))
            total = exact_total(line_amount(body) for _, body in prepared)
            if total <= 0:
                raise ApiError(409, "INVALID_TOTAL", "Issue requires a positive total")
            self.validate_payment(revision["immediatePayment"], total)
            self.repo.check_stock(lines, revision["businessDate"])
            debt = self.settlement.repo.balance(agency["id"])["debt"]
            if debt + total - revision["immediatePayment"] > agency["maxDebt"]:
                raise ApiError(409, "LIMIT_CONFLICT", "Issue exceeds current credit limit")
            for line, body in prepared:
                self.core.repo.put_line(
                    revision["id"],
                    self.core.line_values(self.kind, body, products[line["productId"]]),
                    line["id"],
                )
            rate = self.session.scalar(
                text('SELECT "sellingPriceRate" FROM dms.business_rule WHERE id')
            )
            self.session.execute(
                REVISION.update()
                .where(REVISION.c.id == revision["id"])
                .values(
                    totalAmount=total,
                    sellingPriceRate=rate,
                    maxDebtSnapshot=agency["maxDebt"],
                    state="READY",
                    readyBy=self.actor_id,
                    readyAt=text("clock_timestamp()"),
                    **self.snapshot(agency),
                )
            )
            self.session.execute(
                DOCUMENT.update().where(DOCUMENT.c.id == identifier).values(status="PENDING")
            )
            return lambda: self.result(identifier)

        return self.command(
            "submitStockIssue", f"stock-issue:{identifier}", key, {}, self.permission, work
        )

    def post(self, identifier, condition, key):
        def work(command):
            products = self.core.repo.lock_products(self.core.repo.product_ids(identifier))
            self.inventory.lock_balances(products)
            _, revision, agency = self.lock(
                identifier, condition, "stock.issue.post", "PENDING", products=products
            )
            self.validate_agency(agency, revision["businessDate"])
            confirmation = None
            evidence = UpfrontRepository(self.session)
            if revision["immediatePayment"]:
                confirmation = evidence.for_revision(revision["id"], lock=True)
                self.authorize(("stock.issue.post",))
                if (
                    confirmation is None
                    or confirmation["state"] != "VERIFIED"
                    or confirmation["amount"] != revision["immediatePayment"]
                ):
                    raise ApiError(409, "UPFRONT_REQUIRED", "Verified upfront payment is required")
            lines = self.core.repo.lines(revision["id"])
            self.repo.check_stock(lines, revision["businessDate"])
            self.session.execute(
                DOCUMENT.update().where(DOCUMENT.c.id == identifier).values(status="POSTED")
            )
            self.session.execute(
                REVISION.update()
                .where(REVISION.c.id == revision["id"])
                .values(
                    state="POSTED",
                    postedBy=self.actor_id,
                    postedAt=text("clock_timestamp()"),
                )
            )
            batch = self.core.repo.append_batch(
                revision["id"], "POST", internal_substep_key(command.id, "post"), self.actor_id
            )
            ordering = self.core.repo.document(identifier)["businessOrder"]
            self.inventory.append(batch, lines, revision["businessDate"], ordering, direction=-1)
            if confirmation is not None:
                receipts = PaymentReceiptService(
                    self.session, self.codec, self.actor_id, self.request_id, self.authorize
                )
                receipt_id = receipts.create_internal(
                    agency,
                    revision["businessDate"],
                    confirmation["amount"],
                    confirmation["method"],
                    internal_substep_key(command.id, "auto-receipt"),
                    receipt_type="AUTO_FROM_ISSUE",
                    origin=identifier,
                )
                evidence.finish(confirmation["id"], "CONSUMED", receipt_id)
                self.settlement.post_receipt(receipt_id, command.id)
            else:
                self.settlement.replay(agency["id"], command.id, permission="stock.issue.post")
            return lambda: self.result(identifier, products=products)

        return self.command(
            "postStockIssue", f"stock-issue:{identifier}", key, {}, "stock.issue.post", work
        )

    def replace_pending(self, identifier, body, condition, key):
        def work(command):
            identifiers = set(self.core.repo.product_ids(identifier))
            identifiers.update(int(line.productId) for line in body.lines)
            products = self.core.repo.lock_products(identifiers, active=False)
            self.inventory.lock_balances(products)
            _, revision, agency = self.lock(identifier, condition, self.permission, "PENDING")
            self.validate_agency(agency, body.businessDate)
            if self.session.scalar(
                text("""
                SELECT EXISTS(SELECT 1 FROM dms.upfront_confirmation
                WHERE "issueRevisionId"=:id AND state='VERIFIED')
            """),
                {"id": revision["id"]},
            ):
                raise ApiError(409, "UPFRONT_CONFLICT", "Received money must be separated first")
            values, total = self.prepare_lines(body.lines, products)
            self.validate_payment(body.immediatePayment, total)
            new_id = self.core.new_revision(
                identifier,
                body.businessDate,
                body.reason,
                totalAmount=total,
                immediatePayment=body.immediatePayment,
                note=body.note,
            )
            for line in values:
                self.core.repo.put_line(new_id, line)
            self.session.execute(
                DOCUMENT.update()
                .where(DOCUMENT.c.id == identifier)
                .values(
                    currentRevisionId=new_id,
                    status="DRAFT",
                )
            )
            return lambda: self.result(
                identifier, status=201, location=f"/api/v1/stock-issues/{identifier}"
            )

        return self.command(
            "replacePendingStockIssue",
            f"stock-issue:{identifier}",
            key,
            body.model_dump(),
            self.permission,
            work,
        )

    def cancel_draft(self, identifier, reason, condition, key):
        """Internal no-money branch; whole cancellation remains M29-owned."""

        def work(command):
            self.lock(identifier, condition, "documents.cancel", "DRAFT")
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
            "cancelStockIssue",
            f"stock-issue:{identifier}",
            key,
            reason.model_dump(),
            "documents.cancel",
            work,
        )
