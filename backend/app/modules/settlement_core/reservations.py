from decimal import Decimal
from uuid import UUID

from sqlalchemy import text

from app.core.exceptions import ApiError
from app.modules.settlement_core.allocation import money
from app.modules.settlement_core.service import SettlementService


class ReservationService(SettlementService):
    def refund(self, document_id: int) -> dict:
        source = self.repo.source(document_id)
        if source["kind"] != "REFUND":
            raise ApiError(409, "REFUND_SOURCE_CONFLICT", "Source is not a refund")
        self.lock(source["agencyId"], "cash.refund.post")
        source = self.repo.source(document_id)
        receipt = self.repo.source(source["originDocumentId"])
        if (
            receipt["kind"] != "PAYMENT_RECEIPT"
            or receipt["status"] != "POSTED"
            or (receipt["agencyId"] != source["agencyId"])
        ):
            raise ApiError(409, "REFUND_SOURCE_CONFLICT", "Refund needs same-agency posted cash")
        return source

    def reserve(self, document_id: int) -> tuple[tuple[int, Decimal], ...]:
        source = self.refund(document_id)
        money(source["totalAmount"])
        if (
            source["status"] != "DRAFT"
            or self.repo.reservations(source["revisionId"])
            or (self.repo.blocked_attempt(source["revisionId"]))
        ):
            raise ApiError(409, "STATE_CONFLICT", "Refund is already reserved or terminal")
        remaining, allocations = source["totalAmount"], []
        for lot in self.repo.available(source["agencyId"], receipt_id=source["originDocumentId"]):
            used = min(remaining, max(lot["available"], Decimal(0)))
            if used:
                allocations.append((lot["id"], used))
                remaining -= used
        if remaining:
            raise ApiError(409, "INSUFFICIENT_CREDIT", "Insufficient same-source available credit")
        used_cash = self.session.scalar(
            text("""
            SELECT coalesce(sum(r."totalAmount") FILTER(WHERE d.status='POSTED'),0)
              +coalesce((SELECT sum(x.amount) FROM dms.refund_reservation x
                JOIN dms.document_revision v ON v.id=x."refundRevisionId"
                JOIN dms.document f ON f.id=v."documentId"
                WHERE f."originDocumentId"=:receipt AND x.state='ACTIVE'),0)
            FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
            WHERE d.kind='REFUND' AND d."originDocumentId"=:receipt
        """),
            {"receipt": source["originDocumentId"]},
        )
        if (
            used_cash + source["totalAmount"]
            > self.repo.source(source["originDocumentId"])["totalAmount"]
        ):
            raise ApiError(409, "REFUND_SOURCE_CONFLICT", "Refunds exceed original received cash")
        for lot_id, amount in allocations:
            self.repo.reserve(source["revisionId"], lot_id, amount)
        return tuple(allocations)

    def release(self, document_id: int) -> None:
        source = self.refund(document_id)
        rows = self.repo.reservations(source["revisionId"])
        if source["status"] != "DRAFT" or not rows or any(r["state"] != "ACTIVE" for r in rows):
            raise ApiError(409, "STATE_CONFLICT", "Reservation is not active")
        if self.repo.blocked_attempt(source["revisionId"]):
            raise ApiError(
                409, "STATE_CONFLICT", "In-flight or paid refund retains its reservation"
            )
        self.repo.finish_reservations(source["revisionId"], "RELEASED")

    def consume(self, document_id: int, key: UUID) -> object:
        """Owner first records real paid evidence/date, POST batch and source state."""
        source = self.refund(document_id)
        rows = self.repo.reservations(source["revisionId"])
        if source["status"] != "POSTED" or not rows or any(r["state"] != "ACTIVE" for r in rows):
            raise ApiError(409, "STATE_CONFLICT", "Paid refund requires active reservations")
        if sum((r["amount"] for r in rows), Decimal(0)) != source["totalAmount"]:
            raise ApiError(
                409, "REFUND_SOURCE_CONFLICT", "Refund must consume its full reservation"
            )
        self.repo.finish_reservations(source["revisionId"], "CONSUMED")
        return self.replay(source["agencyId"], key, permission="cash.refund.post")
