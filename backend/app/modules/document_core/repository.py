"""SQL for the three simplified document kinds. Repositories never commit."""

from operator import ge, lt
from types import SimpleNamespace

from sqlalchemy import String, cast, exists, func, select, text
from sqlalchemy.orm import Session, aliased

from app.modules.document_core.models import AGENCY, APP_USER, DOCUMENT, LINE

CREATOR = aliased(APP_USER, name="creator")
POSTER = aliased(APP_USER, name="poster")
SUCCESSOR = aliased(DOCUMENT, name="successor")


def contains_product(document_id, product_id):
    return exists(
        select(LINE.c.id).where(
            LINE.c.documentId == document_id, LINE.c.productId == int(product_id)
        )
    )


def text_id(value):
    return cast(value, String)


DOCUMENT_SQL = """
SELECT d.id, d.code, d.kind, d.status, d."businessDate", d."agencyId", a.code AS "agencyCode",
  a.name AS "agencyName", d."receiptType", d."totalAmount", d."sellingPriceRate", d.note,
  (SELECT count(*) FROM dms.document_line l WHERE l."documentId" = d.id) AS "lineCount",
  d."replacesDocumentId", r.code AS "replacesCode", r.status AS "replacesStatus",
  s.id AS "replacedByDocumentId", s.code AS "replacedByCode", s.status AS "replacedByStatus",
  d."createdBy", cu."fullName" AS "createdByName", d."postedBy", pu."fullName" AS "postedByName",
  d."postedAt", d."cancelledBy", xu."fullName" AS "cancelledByName", d."cancelledAt",
  d."cancelReason", d."createdAt", d."updatedAt", a.debt AS "agencyDebt",
  t."maxDebt" AS "agencyMaxDebt",
  (SELECT p.id FROM dms.online_payment p WHERE p."receiptDocumentId" = d.id) AS "onlinePaymentId"
FROM dms.document d
LEFT JOIN dms.agency a ON a.id = d."agencyId"
LEFT JOIN dms.agency_type t ON t.id = a."typeId"
LEFT JOIN dms.document r ON r.id = d."replacesDocumentId"
LEFT JOIN dms.document s ON s."replacesDocumentId" = d.id
LEFT JOIN dms.app_user cu ON cu.id = d."createdBy"
LEFT JOIN dms.app_user pu ON pu.id = d."postedBy"
LEFT JOIN dms.app_user xu ON xu.id = d."cancelledBy"
WHERE d.id = :id
"""

LINES_SQL = """
SELECT l.id, l."lineNo", l."productId", p.code AS "productCode", l."productName", l."unitId",
  l."unitName", l.quantity, l."unitPrice", l."lineAmount"
FROM dms.document_line l JOIN dms.product p ON p.id = l."productId"
WHERE l."documentId" = :id ORDER BY l."lineNo"
"""


class DocumentRepository:
    """List projection for CatalogueService plus the locking/mutation SQL."""

    model = SimpleNamespace(id=DOCUMENT.c.id)
    columns = {
        "id": DOCUMENT.c.id,
        "code": DOCUMENT.c.code,
        "kind": DOCUMENT.c.kind,
        "status": DOCUMENT.c.status,
        "businessDate": DOCUMENT.c.businessDate,
        "agencyId": text_id(DOCUMENT.c.agencyId),
        "agencyCode": AGENCY.c.code,
        "agencyName": AGENCY.c.name,
        "receiptType": DOCUMENT.c.receiptType,
        "totalAmount": DOCUMENT.c.totalAmount,
        "lineCount": select(func.count(LINE.c.id))
        .where(LINE.c.documentId == DOCUMENT.c.id)
        .scalar_subquery(),
        "note": DOCUMENT.c.note,
        "replacesDocumentId": text_id(DOCUMENT.c.replacesDocumentId),
        "replacedByDocumentId": text_id(
            select(SUCCESSOR.c.id)
            .where(SUCCESSOR.c.replacesDocumentId == DOCUMENT.c.id)
            .scalar_subquery()
        ),
        "createdBy": text_id(DOCUMENT.c.createdBy),
        "createdByName": CREATOR.c.fullName,
        "postedBy": text_id(DOCUMENT.c.postedBy),
        "postedByName": POSTER.c.fullName,
        "postedAt": DOCUMENT.c.postedAt,
        "cancelledAt": DOCUMENT.c.cancelledAt,
        "createdAt": DOCUMENT.c.createdAt,
        "updatedAt": DOCUMENT.c.updatedAt,
    }
    ranges = {
        "fromDate": (DOCUMENT.c.businessDate, ge),
        "toDate": (DOCUMENT.c.businessDate, lt),
        "productId": (DOCUMENT.c.id, contains_product),
    }

    def __init__(self, session: Session, kind: str | None = None) -> None:
        self.session = session
        self.kind = kind

    def query(self):
        query = select(
            text_id(DOCUMENT.c.id).label("id"),
            *(value.label(name) for name, value in self.columns.items() if name != "id"),
        ).select_from(
            DOCUMENT.outerjoin(AGENCY, AGENCY.c.id == DOCUMENT.c.agencyId)
            .outerjoin(CREATOR, CREATOR.c.id == DOCUMENT.c.createdBy)
            .outerjoin(POSTER, POSTER.c.id == DOCUMENT.c.postedBy)
        )
        if self.kind is not None:
            query = query.where(DOCUMENT.c.kind == self.kind)
        return query

    # ------------------------------------------------------------ reads ----

    def document(self, identifier: int):
        return self.session.execute(text(DOCUMENT_SQL), {"id": identifier}).mappings().one_or_none()

    def lines(self, identifier: int):
        return self.session.execute(text(LINES_SQL), {"id": identifier}).mappings().all()

    def lock_document(self, identifier: int):
        return (
            self.session.execute(
                text("SELECT * FROM dms.document WHERE id = :id FOR UPDATE"), {"id": identifier}
            )
            .mappings()
            .one_or_none()
        )

    def today(self):
        return self.session.execute(text("SELECT dms.business_today()")).scalar_one()

    def selling_rate(self):
        return self.session.execute(
            text('SELECT "sellingPriceRate" FROM dms.business_rule WHERE id')
        ).scalar_one()

    def agency(self, identifier: int, *, lock: bool = False):
        return (
            self.session.execute(
                text(
                    'SELECT a.id, a.name, a.status, a.debt, a."acceptedDate", t."maxDebt" '
                    'FROM dms.agency a JOIN dms.agency_type t ON t.id = a."typeId" WHERE a.id = :id'
                    + (" FOR UPDATE OF a" if lock else "")
                ),
                {"id": identifier},
            )
            .mappings()
            .one_or_none()
        )

    def products(self, identifiers, *, lock: bool = False):
        """Products with their unit, locked in ascending id order to avoid deadlocks."""
        if not identifiers:
            return {}
        rows = (
            self.session.execute(
                text(
                    'SELECT p.id, p.name, p.status, p.stock, p."lastPurchasePrice", p."unitId", '
                    'u.name AS "unitName", u.status AS "unitStatus", u."allowsFraction" '
                    'FROM dms.product p JOIN dms.unit u ON u.id = p."unitId" '
                    "WHERE p.id = ANY(:ids) ORDER BY p.id"
                    # Units are share-locked too: a concurrent unit inactivation or
                    # fraction-policy change commits first or waits for this posting.
                    + (" FOR UPDATE OF p FOR SHARE OF u" if lock else "")
                ),
                {"ids": sorted(set(identifiers))},
            )
            .mappings()
            .all()
        )
        return {row["id"]: row for row in rows}

    def raw_lines(self, identifier: int):
        return (
            self.session.execute(
                text(
                    'SELECT id, "productId", quantity, "unitPrice", "lineAmount" '
                    'FROM dms.document_line WHERE "documentId" = :id ORDER BY "lineNo"'
                ),
                {"id": identifier},
            )
            .mappings()
            .all()
        )

    # -------------------------------------------------------- mutations ----

    def insert_document(self, values: dict) -> int:
        columns = ", ".join(f'"{name}"' for name in values)
        params = ", ".join(f":{name}" for name in values)
        return self.session.execute(
            text(f"INSERT INTO dms.document ({columns}) VALUES ({params}) RETURNING id"), values
        ).scalar_one()

    def update_document(self, identifier: int, values: dict) -> None:
        assignments = ", ".join(f'"{name}" = :{name}' for name in values)
        self.session.execute(
            text(f"UPDATE dms.document SET {assignments} WHERE id = :_id"),
            {**values, "_id": identifier},
        )

    def mark_posted(self, identifier: int, actor: int | None, total, rate=None) -> None:
        self.session.execute(
            text(
                "UPDATE dms.document SET status = 'POSTED', \"postedBy\" = :actor, "
                '"postedAt" = dms.app_now(), "totalAmount" = :total, "sellingPriceRate" = :rate '
                "WHERE id = :id"
            ),
            {"id": identifier, "actor": actor, "total": total, "rate": rate},
        )

    def mark_cancelled(self, identifier: int, actor: int | None, reason: str) -> None:
        self.session.execute(
            text(
                "UPDATE dms.document SET status = 'CANCELLED', \"cancelledBy\" = :actor, "
                '"cancelledAt" = dms.app_now(), "cancelReason" = :reason WHERE id = :id'
            ),
            {"id": identifier, "actor": actor, "reason": reason},
        )

    def delete_document(self, identifier: int) -> None:
        self.session.execute(text("DELETE FROM dms.document WHERE id = :id"), {"id": identifier})

    def replace_lines(self, identifier: int, lines: list[dict]) -> None:
        self.session.execute(
            text('DELETE FROM dms.document_line WHERE "documentId" = :id'), {"id": identifier}
        )
        for number, line in enumerate(lines, start=1):
            self.session.execute(
                text(
                    'INSERT INTO dms.document_line ("documentId", "lineNo", "productId", "unitId", '
                    '"productName", "unitName", quantity, "unitPrice") VALUES (:document, :number, '
                    ":productId, :unitId, :productName, :unitName, :quantity, :unitPrice)"
                ),
                {"document": identifier, "number": number, **line},
            )

    def set_line_price(self, line_id: int, price) -> None:
        self.session.execute(
            text('UPDATE dms.document_line SET "unitPrice" = :price WHERE id = :id'),
            {"id": line_id, "price": price},
        )

    def change_stock(self, product_id: int, delta, price=None, *, set_price=False) -> None:
        if set_price:
            self.session.execute(
                text(
                    'UPDATE dms.product SET stock = stock + :delta, "lastPurchasePrice" = :price '
                    "WHERE id = :id"
                ),
                {"id": product_id, "delta": delta, "price": price},
            )
        else:
            self.session.execute(
                text("UPDATE dms.product SET stock = stock + :delta WHERE id = :id"),
                {"id": product_id, "delta": delta},
            )

    def latest_purchase_price(self, product_id: int):
        """Unit price of the most recently posted, still-posted receipt line of a product."""
        return self.session.execute(
            text(
                'SELECT l."unitPrice" FROM dms.document_line l JOIN dms.document d '
                'ON d.id = l."documentId" WHERE l."productId" = :id AND d.kind = \'STOCK_RECEIPT\' '
                "AND d.status = 'POSTED' ORDER BY d.\"postedAt\" DESC, d.id DESC LIMIT 1"
            ),
            {"id": product_id},
        ).scalar_one_or_none()

    def set_purchase_price(self, product_id: int, price) -> None:
        self.session.execute(
            text('UPDATE dms.product SET "lastPurchasePrice" = :price WHERE id = :id'),
            {"id": product_id, "price": price},
        )

    def change_debt(self, agency_id: int, delta) -> None:
        self.session.execute(
            text("UPDATE dms.agency SET debt = debt + :delta WHERE id = :id"),
            {"id": agency_id, "delta": delta},
        )
