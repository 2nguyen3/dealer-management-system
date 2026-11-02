from collections import defaultdict
from decimal import Decimal

from psycopg.errors import SerializationFailure
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.settlement_core.models import Event, Leg, Lot, LotKey


class SettlementRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def lock_agency(self, agency_id: int) -> dict:
        type_id = self.session.scalar(
            text('SELECT "typeId" FROM dms.agency WHERE id=:id'), {"id": agency_id}
        )
        if type_id is None:
            raise ApiError(404, "NOT_FOUND", "Agency not found")
        maximum = self.session.scalar(
            text('SELECT "maxDebt" FROM dms.agency_type WHERE id=:id FOR SHARE'), {"id": type_id}
        )
        row = dict(
            self.session.execute(
                text("SELECT * FROM dms.agency WHERE id=:id FOR SHARE"), {"id": agency_id}
            )
            .mappings()
            .one()
        )
        if row["typeId"] != type_id:
            raise DBAPIError(None, None, SerializationFailure("Agency type changed"))
        self.session.execute(
            text('SELECT "agencyId" FROM dms.agency_balance WHERE "agencyId"=:id FOR UPDATE'),
            {"id": agency_id},
        ).one()
        return {**row, "maxDebt": maximum}

    def lock_history(self, agency_id: int) -> None:
        self.session.execute(
            text("""
            SELECT d.id,r.id FROM dms.document d JOIN dms.document_revision r
              ON r.id=d."currentRevisionId" WHERE d."agencyId"=:id
            ORDER BY d.id FOR UPDATE OF d,r
        """),
            {"id": agency_id},
        ).all()
        self.session.execute(
            text("""
            SELECT id FROM dms.credit_lot WHERE "agencyId"=:id ORDER BY id FOR UPDATE
        """),
            {"id": agency_id},
        ).all()

    def source(self, document_id: int) -> dict:
        row = (
            self.session.execute(
                text("""
            SELECT d.*,r.id AS "revisionId",r.state,r."businessDate",r."totalAmount",
              r."paymentMethod" FROM dms.document d JOIN dms.document_revision r
              ON r.id=d."currentRevisionId" WHERE d.id=:id
        """),
                {"id": document_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Financial source not found")
        return dict(row)

    def lots(self, agency_id: int) -> tuple[Lot, ...]:
        rows = self.session.execute(
            text("""
            SELECT l.*,r."businessDate",d."businessOrder",
              CASE WHEN d.kind='SALES_RETURN' THEN d."currentRevisionId"
                ELSE l."sourceRevisionId" END AS "effectiveRevisionId",
              coalesce((SELECT sum(e.amount) FROM dms.credit_entry e
                WHERE e."lotId"=l.id AND e.kind='CREATED' AND e."reversesEntryId" IS NULL
                AND NOT EXISTS(SELECT 1 FROM dms.credit_entry x WHERE x."reversesEntryId"=e.id)),0)
                AS created,
              coalesce((SELECT sum(x.amount) FROM dms.refund_reservation x
                WHERE x."lotId"=l.id AND x.state='ACTIVE'),0) AS reserved
            FROM dms.credit_lot l JOIN dms.document_revision original
              ON original.id=l."sourceRevisionId"
              JOIN dms.document d ON d.id=original."documentId"
              JOIN dms.document_revision r ON r.id=CASE WHEN d.kind='SALES_RETURN'
                THEN d."currentRevisionId" ELSE l."sourceRevisionId" END
            WHERE l."agencyId"=:id ORDER BY r."businessDate",l.id
        """),
            {"id": agency_id},
        ).mappings()
        return tuple(
            Lot(
                LotKey(r["effectiveRevisionId"], r["originReceiptId"], r["id"]),
                r["businessDate"],
                r["businessOrder"],
                r["created"],
                r["reserved"],
            )
            for r in rows
        )

    def events(self, agency_id: int) -> tuple[Event, ...]:
        rows = (
            self.session.execute(
                text("""
            SELECT d.id,d.kind,d."agencyId",d."originDocumentId",d."receiptType",
              r.id AS "revisionId",r."businessDate",r."totalAmount",r."paymentMethod",
              CASE WHEN d."receiptType"='AUTO_FROM_ISSUE' THEN o."businessOrder"
                ELSE d."businessOrder" END AS ordering
            FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
              LEFT JOIN dms.document o ON o.id=d."originDocumentId"
            WHERE d."agencyId"=:id AND d.status='POSTED' ORDER BY d.id
        """),
                {"id": agency_id},
            )
            .mappings()
            .all()
        )
        consumed = defaultdict(list)
        for row in self.session.execute(
            text("""
            SELECT x."refundRevisionId",x.amount,l.id,l."originReceiptId",
              CASE WHEN owner.kind='SALES_RETURN' THEN owner."currentRevisionId"
                ELSE l."sourceRevisionId" END AS "sourceRevisionId"
            FROM dms.refund_reservation x JOIN dms.credit_lot l ON l.id=x."lotId"
              JOIN dms.document_revision source ON source.id=l."sourceRevisionId"
              JOIN dms.document owner ON owner.id=source."documentId"
            WHERE l."agencyId"=:id AND x.state='CONSUMED' ORDER BY l.id
        """),
            {"id": agency_id},
        ).mappings():
            consumed[row["refundRevisionId"]].append(
                (LotKey(row["sourceRevisionId"], row["originReceiptId"], row["id"]), row["amount"])
            )
        return tuple(
            Event(
                r["id"],
                r["revisionId"],
                agency_id,
                r["kind"],
                r["businessDate"],
                r["ordering"],
                r["totalAmount"],
                r["originDocumentId"],
                r["receiptType"],
                r["paymentMethod"],
                tuple(consumed[r["revisionId"]]),
            )
            for r in rows
        )

    def effective(self, revision_id: int, ledger: str) -> list[dict]:
        if ledger not in ("receivable", "credit"):
            raise ValueError("Invalid financial ledger")
        return [
            dict(row)
            for row in self.session.execute(
                text(f"""
            SELECT e.* FROM dms.{ledger}_entry e JOIN dms.posting_batch b ON b.id=e."batchId"
            WHERE b."revisionId"=:id AND e."reversesEntryId" IS NULL
              AND NOT EXISTS(SELECT 1 FROM dms.{ledger}_entry x WHERE x."reversesEntryId"=e.id)
            ORDER BY e.id
        """),
                {"id": revision_id},
            ).mappings()
        ]

    def ensure_lot(self, agency_id: int, key: LotKey) -> int:
        if key.id:
            return key.id
        return self.session.scalar(
            text("""
            INSERT INTO dms.credit_lot ("agencyId","sourceRevisionId","originReceiptId")
            VALUES (:agency,:revision,:receipt) RETURNING id
        """),
            {"agency": agency_id, "revision": key.revision_id, "receipt": key.receipt_id},
        )

    def append(self, event: Event, batch_id: int, leg: Leg, target: int) -> None:
        if leg.ledger not in ("receivable", "credit"):
            raise ValueError("Invalid financial ledger")
        column = "issueDocumentId" if leg.ledger == "receivable" else "lotId"
        self.session.execute(
            text(f'''
            INSERT INTO dms.{leg.ledger}_entry
              ("batchId","agencyId","{column}",kind,amount,"businessDate","businessOrder")
            VALUES (:batch,:agency,:target,:kind,:amount,:date,:ordering)
        '''),
            {
                "batch": batch_id,
                "agency": event.agency_id,
                "target": target,
                "kind": leg.kind,
                "amount": leg.amount,
                "date": event.business_date,
                "ordering": event.business_order,
            },
        )

    def reverse(self, batch_id: int, ledger: str, entry: dict) -> None:
        if ledger not in ("receivable", "credit"):
            raise ValueError("Invalid financial ledger")
        column = "issueDocumentId" if ledger == "receivable" else "lotId"
        self.session.execute(
            text(f'''
            INSERT INTO dms.{ledger}_entry ("batchId","agencyId","{column}",kind,amount,
              "businessDate","businessOrder","reversesEntryId")
            VALUES (:batch,:agency,:target,:kind,:amount,:date,:ordering,:original)
        '''),
            {
                "batch": batch_id,
                "agency": entry["agencyId"],
                "target": entry[column],
                "kind": entry["kind"],
                "amount": -entry["amount"],
                "date": entry["businessDate"],
                "ordering": entry["businessOrder"],
                "original": entry["id"],
            },
        )

    def available(self, agency_id: int, *, receipt_id: int | None = None) -> list[dict]:
        return [
            dict(row)
            for row in self.session.execute(
                text("""
            SELECT l.id,l."originReceiptId",l."sourceRevisionId",r."businessDate",
              coalesce((SELECT sum(e.amount) FROM dms.credit_entry e WHERE e."lotId"=l.id),0)
              -coalesce((SELECT sum(x.amount) FROM dms.refund_reservation x
                WHERE x."lotId"=l.id AND x.state='ACTIVE'),0) AS available
            FROM dms.credit_lot l JOIN dms.document_revision original
              ON original.id=l."sourceRevisionId"
              JOIN dms.document d ON d.id=original."documentId"
              JOIN dms.document_revision r ON r.id=CASE WHEN d.kind='SALES_RETURN'
                THEN d."currentRevisionId" ELSE l."sourceRevisionId" END
            WHERE l."agencyId"=:agency AND
              (CAST(:receipt AS bigint) IS NULL OR l."originReceiptId"=:receipt)
            ORDER BY r."businessDate",l.id
        """),
                {"agency": agency_id, "receipt": receipt_id},
            ).mappings()
        ]

    def balance(self, agency_id: int, checkpoint: tuple | None = None) -> dict:
        row = (
            self.session.execute(
                text("""
            SELECT a.id AS "agencyId",
              coalesce((SELECT sum(e.amount) FROM dms.receivable_entry e WHERE e."agencyId"=a.id
                AND (CAST(:day AS date) IS NULL OR (e."businessDate",e."businessOrder")<=
                  (CAST(:day AS date),CAST(:ordering AS bigint)))),0) AS debt,
              coalesce((SELECT sum(e.amount) FROM dms.credit_entry e WHERE e."agencyId"=a.id
                AND (CAST(:day AS date) IS NULL OR (e."businessDate",e."businessOrder")<=
                  (CAST(:day AS date),CAST(:ordering AS bigint)))),0) AS credit,
              coalesce((SELECT sum(x.amount) FROM dms.refund_reservation x
                JOIN dms.credit_lot l ON l.id=x."lotId" WHERE l."agencyId"=a.id
                AND x.state='ACTIVE'),0) AS reserved
            FROM dms.agency a WHERE a.id=:id
        """),
                {
                    "id": agency_id,
                    "day": None if checkpoint is None else checkpoint[0],
                    "ordering": None if checkpoint is None else checkpoint[1],
                },
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Agency not found")
        return dict(row)

    def reservations(self, revision_id: int) -> list[dict]:
        return [
            dict(row)
            for row in self.session.execute(
                text("""
            SELECT * FROM dms.refund_reservation WHERE "refundRevisionId"=:id
            ORDER BY "lotId" FOR UPDATE
        """),
                {"id": revision_id},
            ).mappings()
        ]

    def blocked_attempt(self, revision_id: int) -> bool:
        return bool(
            self.session.scalar(
                text("""
            SELECT EXISTS(SELECT 1 FROM dms.refund_attempt WHERE "refundRevisionId"=:id
              AND state IN ('PENDING','UNKNOWN','SUCCESS'))
        """),
                {"id": revision_id},
            )
        )

    def reserve(self, revision_id: int, lot_id: int, amount: Decimal) -> None:
        self.session.execute(
            text("""
            INSERT INTO dms.refund_reservation ("refundRevisionId","lotId",amount)
            VALUES (:revision,:lot,:amount)
        """),
            {"revision": revision_id, "lot": lot_id, "amount": amount},
        )

    def finish_reservations(self, revision_id: int, state: str) -> None:
        if state not in ("RELEASED", "CONSUMED"):
            raise ValueError("Invalid reservation terminal state")
        self.session.execute(
            text("""
            UPDATE dms.refund_reservation SET state=:state
            WHERE "refundRevisionId"=:id AND state='ACTIVE'
        """),
            {"state": state, "id": revision_id},
        )
