from collections import defaultdict
from decimal import Decimal
from uuid import UUID, uuid5

from sqlalchemy import text

from app.core.exceptions import ApiError
from app.core.request_context import set_audit_context
from app.modules.document_core.repository import DocumentRepository
from app.modules.settlement_core.models import Leg
from app.modules.settlement_core.replay import plan_replay
from app.modules.settlement_core.repository import SettlementRepository

WRITERS = {
    "documents.correct",
    "documents.cancel",
    "stock.issue.post",
    "cash.receipt.post",
    "returns.post",
    "credit.apply",
    "cash.refund.post",
    "payments.online",
}


def normalized_legs(legs) -> dict:
    result = defaultdict(Decimal)
    for leg in legs:
        result[(leg.ledger, leg.kind, leg.target)] += leg.amount
    return dict(result)


class SettlementService:
    def __init__(self, session, actor_id, request_id, authorize):
        self.session, self.actor_id, self.request_id, self.authorize = (
            session,
            actor_id,
            request_id,
            authorize,
        )
        self.repo, self.documents = SettlementRepository(session), DocumentRepository(session)

    def lock(self, agency_id: int, permission: str) -> dict:
        if permission not in WRITERS:
            raise ValueError("Invalid settlement caller permission")
        self.authorize((permission,))
        set_audit_context(self.session, self.actor_id, self.request_id, function_code=permission)
        agency = self.repo.lock_agency(agency_id)
        self.repo.lock_history(agency_id)
        self.authorize((permission,))
        return agency

    def replay(self, agency_id: int, key: UUID, *, permission: str) -> object:
        """Call after the owning workflow has prepared all source/evidence/stock legs."""
        agency = self.lock(agency_id, permission)
        lots = self.repo.lots(agency_id)
        plan = plan_replay(agency_id, self.repo.events(agency_id), lots)
        if plan.debt > agency["maxDebt"]:
            raise ApiError(409, "LIMIT_CONFLICT", "Current debt exceeds agency limit")
        identities = {lot.key: lot.key.id for lot in lots}
        for event, legs in plan.sources:
            current = {
                ledger: self.repo.effective(event.revision_id, ledger)
                for ledger in ("receivable", "credit")
            }
            existing = []
            for ledger, entries in current.items():
                for entry in entries:
                    target = (
                        entry["issueDocumentId"]
                        if ledger == "receivable"
                        else next(lot.key for lot in lots if lot.key.id == entry["lotId"])
                    )
                    existing.append(Leg(ledger, entry["kind"], target, entry["amount"]))
            wanted = normalized_legs(legs)
            if normalized_legs(existing) == wanted:
                continue
            # No financial mutation of paid refund evidence/legs is permitted.
            if event.kind == "REFUND" and existing:
                raise ApiError(409, "REFUND_SOURCE_CONFLICT", "Paid refund effects are immutable")
            batch = self.documents.append_batch(
                event.revision_id,
                "REALLOCATE",
                uuid5(key, f"settlement:{event.revision_id}"),
                self.actor_id,
            )
            for ledger, entries in current.items():
                for entry in entries:
                    self.repo.reverse(batch, ledger, entry)
            for (ledger, kind, target), amount in wanted.items():
                if ledger == "credit":
                    if target not in identities:
                        identities[target] = self.repo.ensure_lot(agency_id, target)
                    identifier = identities[target]
                else:
                    identifier = target
                self.repo.append(event, batch, Leg(ledger, kind, target, amount), identifier)
        return plan

    def post_receipt(self, document_id: int, key: UUID) -> object:
        source = self.repo.source(document_id)
        if source["kind"] != "PAYMENT_RECEIPT":
            raise ApiError(409, "STATE_CONFLICT", "Source is not a payment receipt")
        permission = (
            "stock.issue.post"
            if source["receiptType"] == "AUTO_FROM_ISSUE"
            else "payments.online"
            if source["paymentMethod"] == "ONLINE"
            else "cash.receipt.post"
        )
        agency = self.lock(source["agencyId"], permission)
        source = self.repo.source(document_id)
        if source["status"] != "DRAFT" or source["state"] != "DRAFT":
            raise ApiError(409, "STATE_CONFLICT", "Only a draft receipt can be posted")
        if source["businessDate"] < agency["acceptedDate"]:
            raise ApiError(409, "AGENCY_CONFLICT", "Receipt predates agency acceptance")
        self.session.execute(
            text("""
            UPDATE dms.document_revision SET "agencyName"=:name,"agencyEmail"=:email,
              "agencyAddress"=:address,"agencyPhone"=:phone,state='POSTED',
              "postedBy"=:actor,"postedAt"=clock_timestamp() WHERE id=:id
        """),
            {**agency, "actor": self.actor_id, "id": source["revisionId"]},
        )
        self.session.execute(
            text("UPDATE dms.document SET status='POSTED' WHERE id=:id"), {"id": document_id}
        )
        self.documents.append_batch(
            source["revisionId"], "POST", uuid5(key, "receipt-post"), self.actor_id
        )
        return self.replay(source["agencyId"], key, permission=permission)
