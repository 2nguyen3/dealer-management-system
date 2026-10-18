from sqlalchemy import text

from app.core.exceptions import ApiError


class StockCountRepository:
    def __init__(self, session):
        self.session = session

    def header(self, identifier, *, lock=False):
        row = (
            self.session.execute(
                text(
                    "SELECT * FROM dms.stock_count WHERE id=:id"
                    + (" FOR UPDATE" if lock else " FOR SHARE")
                ),
                {"id": identifier},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Stock count not found")
        return dict(row)

    def lines(self, identifier):
        return [
            dict(row)
            for row in self.session.execute(
                text("""
            SELECT l.*,p.code AS "productCode",p.name AS "productName",u.name AS "unitName"
            FROM dms.stock_count_line l JOIN dms.product p ON p.id=l."productId"
            JOIN dms.unit u ON u.id=l."unitId" WHERE l."countId"=:id ORDER BY l.id
        """),
                {"id": identifier},
            ).mappings()
        ]

    def product_ids(self, identifier):
        return tuple(
            self.session.scalars(
                text(
                    'SELECT "productId" FROM dms.stock_count_line '
                    'WHERE "countId"=:id ORDER BY "productId"'
                ),
                {"id": identifier},
            )
        )

    def observation(self, identifier):
        return self.session.execute(
            text("""
            SELECT "currentStock",(SELECT max(id) FROM dms.inventory_entry
              WHERE "productId"=:id) AS last
            FROM dms.inventory_balance WHERE "productId"=:id
        """),
            {"id": identifier},
        ).one()

    def create(self, body, actor):
        return self.session.scalar(
            text(
                'INSERT INTO dms.stock_count ("countedAt",reason,"createdBy") '
                "VALUES (:day,:reason,:actor) RETURNING id"
            ),
            {"day": body.countedAt, "reason": body.reason, "actor": actor},
        )

    def update(self, identifier, values):
        # Values only originate from the typed header schema or fixed service fields.
        assignments = ",".join('"' + key + '"=:' + key for key in values)
        self.session.execute(
            text(f"UPDATE dms.stock_count SET {assignments} WHERE id=:identifier"),
            {**values, "identifier": identifier},
        )

    def put_line(self, identifier, product, quantity, *, line_id=None, refresh=True):
        observation = self.observation(product["id"]) if refresh else None
        if line_id is None:
            return self.session.scalar(
                text("""
                INSERT INTO dms.stock_count_line ("countId","productId","unitId",
                  "bookQuantity","countedQuantity","observedLastEntryId")
                VALUES (:parent,:product,:unit,:book,:counted,:last) RETURNING id
            """),
                {
                    "parent": identifier,
                    "product": product["id"],
                    "unit": product["unitId"],
                    "book": observation.currentStock,
                    "counted": quantity,
                    "last": observation.last,
                },
            )
        values = {"id": line_id, "quantity": quantity}
        assignments = '"countedQuantity"=:quantity'
        if refresh:
            assignments += ',"bookQuantity"=:book,"observedLastEntryId"=:last'
            values.update(book=observation.currentStock, last=observation.last)
        self.session.execute(
            text(f"UPDATE dms.stock_count_line SET {assignments} WHERE id=:id"), values
        )
        return line_id

    def listing(self):
        # IDs and boundaries use bound predicates in the service; only fixed SQL is composed.
        return text("""SELECT id,"countedAt" FROM dms.stock_count
                WHERE (CAST(:code AS text) IS NULL OR code=:code)
                AND (CAST(:state AS text) IS NULL OR state=:state)
                AND (CAST(:product AS bigint) IS NULL OR EXISTS(
                  SELECT 1 FROM dms.stock_count_line l
                  WHERE l."countId"=stock_count.id AND l."productId"=:product))
                AND (CAST(:start AS timestamptz) IS NULL OR "countedAt">=:start)
                AND (CAST(:end AS timestamptz) IS NULL OR "countedAt"<:end)""")
