from datetime import datetime

from sqlalchemy import text

from app.common.pagination import build_page
from app.core.exceptions import ApiError
from app.modules.document_core.financial import authorize_any
from app.modules.refunds.schemas import RefundAttemptList, RefundReservation, RefundReservationList


class RefundEvidenceReads:
    """Read projections composed with the owning refund workflow; no transaction writes."""

    def __init__(self, service):
        self.service = service

    def attempt(self, identifier):
        use = self.service
        authorize_any(use.authorize, ("cash.refund.post", "debt.read"))
        return use.project_attempt(use.attempt(identifier))

    def page(self, identifier, *, resource, limit=25, cursor=None, state=None, sort="-createdAt"):
        use = self.service
        authorize_any(use.authorize, ("cash.refund.post", "debt.read"))
        use.source(identifier)
        if sort not in ("id", "-id", "createdAt", "-createdAt"):
            raise ApiError(422, "VALIDATION_FAILED", "Invalid evidence sort")
        scope = {"operation": resource, "refundId": identifier, "sort": sort, "state": state}
        keys = (None, None) if cursor is None else use.codec.decode(cursor, scope, [datetime, int])
        table = "refund_attempt" if resource == "attempts" else "refund_reservation"
        filters = ['r."documentId"=:document']
        parameters = {"document": identifier, "fetch": limit + 1}
        if state is not None:
            filters.append("e.state=:state")
            parameters["state"] = state
        direction = "DESC" if sort.startswith("-") else "ASC"
        operator = "<" if sort.startswith("-") else ">"
        if keys[1] is not None:
            filters.append(
                f"e.id{operator}:id"
                if sort.lstrip("-") == "id"
                else f'(e."createdAt",e.id){operator}(:time,:id)'
            )
            parameters.update(time=keys[0], id=keys[1])
        ordering = (
            f"e.id {direction}"
            if sort.lstrip("-") == "id"
            else f'e."createdAt" {direction},e.id {direction}'
        )
        rows = (
            use.session.execute(
                text(f"""
            SELECT e.*,r."documentId" AS "refundDocumentId" FROM dms.{table} e
            JOIN dms.document_revision r ON r.id=e."refundRevisionId"
            WHERE {" AND ".join(filters)} ORDER BY {ordering} LIMIT :fetch
        """),
                parameters,
            )
            .mappings()
            .all()
        )
        if resource == "attempts":
            models = [use.project_attempt(row) for row in rows]
            model = RefundAttemptList
        else:
            models = [
                RefundReservation.model_validate(
                    {
                        key: str(value) if key in ("id", "refundRevisionId", "lotId") else value
                        for key, value in row.items()
                        if key != "refundDocumentId"
                    }
                )
                for row in rows
            ]
            model = RefundReservationList
        items, pagination = build_page(
            models, limit, use.codec, scope, lambda item: [item.createdAt, int(item.id)]
        )
        return model(items=items, pagination=pagination)
