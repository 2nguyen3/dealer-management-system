from sqlalchemy import select, text

from app.common.commands import CommandResult
from app.common.pagination import build_page
from app.core.exceptions import ApiError, AuthError
from app.modules.document_core.financial import FinancialDocumentService
from app.modules.document_core.models import REVISION
from app.modules.document_core.schemas import DraftLine
from app.modules.document_core.service import PREPARE_PERMISSIONS, READ_PERMISSIONS, exact_total
from app.modules.document_history.repository import HistoryRepository
from app.modules.document_history.schemas import LineList, RevisionList
from app.modules.sales_returns.schemas import ReturnLineInput
from app.modules.sales_returns.service import SalesReturnService


class DocumentHistoryService(FinancialDocumentService):
    repository = HistoryRepository
    operation = "searchDocuments"

    def search(self, *, kind=None, **filters):
        allowed = []
        for candidate in READ_PERMISSIONS:
            try:
                self.core.authorize_read(candidate)
                allowed.append(candidate)
            except AuthError as error:
                if error.status != 403 or error.code != "FORBIDDEN":
                    raise
        if not allowed or (kind is not None and kind not in allowed):
            raise AuthError(403, "FORBIDDEN", "Permission denied")
        # Calling catalogue list directly avoids a single-kind financial read policy.
        from app.common.catalogue import CatalogueService

        start, end = filters.get("fromDate"), filters.get("toDate")
        if start is not None and end is not None and start >= end:
            raise ApiError(422, "VALIDATION_FAILED", "Invalid business-date interval")
        return CatalogueService.list(self, kind=kind, authorizedKinds=tuple(allowed), **filters)

    def revision(self, identifier, number):
        return self.core.get_revision(identifier, number)

    def revisions(self, identifier, *, limit=25, cursor=None, state=None, sort="-revisionNo"):
        document = self.core.repo.document(identifier, lock=True)
        self.core.authorize_read(document["kind"])
        if sort not in ("revisionNo", "-revisionNo"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid revision sort")
        scope = {
            "operation": "listDocumentRevisions",
            "documentId": identifier,
            "state": state,
            "sort": sort,
        }
        anchor = None if cursor is None else self.codec.decode(cursor, scope, [int])[0]
        query = select(REVISION.c.revisionNo).where(REVISION.c.documentId == identifier)
        if state is not None:
            query = query.where(REVISION.c.state == state)
        if anchor is not None:
            query = query.where(
                REVISION.c.revisionNo < anchor
                if sort.startswith("-")
                else REVISION.c.revisionNo > anchor
            )
        query = query.order_by(
            REVISION.c.revisionNo.desc() if sort.startswith("-") else REVISION.c.revisionNo
        ).limit(limit + 1)
        models = [self.revision(identifier, number) for number in self.session.scalars(query)]
        items, pagination = build_page(
            models, limit, self.codec, scope, lambda item: [item.revisionNo]
        )
        return RevisionList(items=items, pagination=pagination)

    def lines(self, identifier, number, *, limit=25, cursor=None, productId=None, sort="lineNo"):
        revision = self.revision(identifier, number)
        if sort not in ("lineNo", "-lineNo"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid line sort")
        scope = {
            "operation": "listDocumentLines",
            "documentId": identifier,
            "revisionNo": number,
            "productId": productId,
            "sort": sort,
        }
        anchor = None if cursor is None else self.codec.decode(cursor, scope, [int])[0]
        models = sorted(
            (line for line in revision.lines if productId is None or line.productId == productId),
            key=lambda line: line.lineNo,
            reverse=sort.startswith("-"),
        )
        if anchor is not None:
            models = [
                line
                for line in models
                if (line.lineNo < anchor if sort.startswith("-") else line.lineNo > anchor)
            ]
        items, pagination = build_page(
            models[: limit + 1], limit, self.codec, scope, lambda line: [line.lineNo]
        )
        return LineList(items=items, pagination=pagination)

    def line(self, identifier, number, line_id):
        return self.core.get_line(identifier, number, line_id)

    def prepare_permission(self, identifier):
        document = self.core.repo.document(identifier)
        if document["kind"] not in PREPARE_PERMISSIONS:
            self.core.authorize_read(document["kind"])
            raise ApiError(409, "LINE_CONFLICT", "Financial-only documents have no goods lines")
        return PREPARE_PERMISSIONS[document["kind"]]

    def edit(self, identifier, number, body, condition, line_id=None):
        document = self.core.repo.document(identifier)
        if body is not None and body.kind != document["kind"]:
            raise ApiError(409, "LINE_CONFLICT", "Line kind differs from parent")
        if document["kind"] == "SALES_RETURN":
            return self.edit_return(identifier, number, body, condition, line_id)
        products = set(self.core.repo.product_ids(identifier))
        if body is not None:
            products.add(int(body.productId))
        self.core.repo.lock_products(products, active=False)
        self.inventory.lock_balances(products)
        if document["agencyId"] is not None:
            self.lock_agency(document["agencyId"], PREPARE_PERMISSIONS[document["kind"]])
            self.settlement.repo.lock_history(document["agencyId"])
        if self.session.scalar(
            text(
                "SELECT EXISTS(SELECT 1 FROM dms.stock_count "
                "WHERE \"adjustmentDocumentId\"=:id AND state='CONFIRMED')"
            ),
            {"id": identifier},
        ):
            raise ApiError(409, "STATE_CONFLICT", "Confirmed count adjustment is immutable")
        self.core.draft(identifier, number, condition, products)
        prepared = None
        if body is not None:
            if body.kind == "STOCK_ISSUE":
                prepared = self.core.prepare_issue_line(int(body.productId), body.quantity)
            else:
                prepared = DraftLine(
                    kind=body.kind,
                    productId=body.productId,
                    quantity=body.quantity,
                    unitPrice=body.unitPrice if body.kind == "STOCK_RECEIPT" else "0",
                )
        return self.core.edit_line(identifier, number, prepared, condition, line_id)

    def edit_return(self, identifier, number, body, condition, line_id):
        returns = SalesReturnService(
            self.session, self.codec, self.actor_id, self.request_id, self.authorize
        )
        document, revision, origin, agency, products = returns.lock_draft(
            identifier, condition, "returns.prepare"
        )
        if revision["revisionNo"] != number:
            raise ApiError(404, "NOT_FOUND", "Current revision not found")
        current = self.core.repo.lines(revision["id"])
        old = next((line for line in current if line["id"] == line_id), None)
        if line_id is not None and old is None:
            raise ApiError(404, "NOT_FOUND", "Line not found")
        proposed = [
            (
                line["id"],
                ReturnLineInput(originLineId=str(line["originLineId"]), quantity=line["quantity"]),
            )
            for line in current
            if line["id"] != line_id
        ]
        if body is not None:
            proposed.append(
                (line_id, ReturnLineInput(originLineId=body.originLineId, quantity=body.quantity))
            )
        values = returns.prepare_lines(
            origin, [value for _, value in proposed], products, revision["businessDate"]
        )
        if body is None:
            self.core.repo.remove_line(line_id)
        result_id = None
        for (existing, _), value in zip(proposed, values, strict=True):
            result_id = self.core.repo.put_line(revision["id"], value, existing)
        self.core.repo.set_total(
            revision["id"], exact_total(value["returnAmount"] for value in values)
        )
        return None if body is None else self.core.get_line(identifier, number, result_id)

    def create_line(self, identifier, number, body, condition, key):
        permission = self.prepare_permission(identifier)

        def work(command):
            line = self.edit(identifier, number, body, condition)

            def project():
                return CommandResult(
                    status=201,
                    body=line.model_dump(mode="json"),
                    headers={
                        "ETag": self.core.etag(self.core.get(identifier)),
                        "Location": f"/api/v1/documents/{identifier}/revisions/"
                        f"{number}/lines/{line.id}",
                    },
                )

            return project

        return self.command(
            "createDocumentLine",
            f"document:{identifier}:revision:{number}",
            key,
            body.model_dump(),
            permission,
            work,
        )

    def change_line(self, identifier, number, condition, body=None, line_id=None):
        self.permission = self.prepare_permission(identifier)

        def work():
            line = self.edit(identifier, number, body, condition, line_id)

            def project():
                return CommandResult(
                    status=204 if body is None else 200,
                    body=None if line is None else line.model_dump(mode="json"),
                    headers={"ETag": self.core.etag(self.core.get(identifier))},
                )

            return project

        return self.write(work)
