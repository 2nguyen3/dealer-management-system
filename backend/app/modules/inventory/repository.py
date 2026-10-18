from sqlalchemy import text

from app.core.exceptions import ApiError
from app.modules.document_core.batches import reversal_values
from app.modules.document_core.schemas import InventoryChange


class InventoryRepository:
    def __init__(self, session):
        self.session = session

    def statement(self, product_id: int, *, descending: bool, **parameters) -> dict:
        direction, comparison = ("DESC", "<") if descending else ("ASC", ">")
        # One SQL snapshot: calculate complete atomic checkpoints before any display filter.
        row = (
            self.session.execute(
                text(f"""
            WITH ledger AS (
              SELECT e.*,d.id AS "sourceDocumentId",d.code AS "sourceDocumentCode",
                r."revisionNo" AS "sourceRevisionNo",
                e."reversesEntryId" IS NULL AND NOT EXISTS(
                  SELECT 1 FROM dms.inventory_entry x WHERE x."reversesEntryId"=e.id
                ) AS "isEffective",
                sum(e.quantity) OVER (ORDER BY e."businessDate",e."businessOrder"
                  RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS "balanceAfter"
              FROM dms.inventory_entry e JOIN dms.posting_batch b ON b.id=e."batchId"
                JOIN dms.document_revision r ON r.id=b."revisionId"
                JOIN dms.document d ON d.id=r."documentId"
              WHERE e."productId"=:product
            ), page AS (
              SELECT *,jsonb_build_object(
                'id',id::text,'sourceDocumentId',"sourceDocumentId"::text,
                'sourceDocumentCode',"sourceDocumentCode",'sourceRevisionNo',"sourceRevisionNo",
                'businessDate',"businessDate",'businessOrder',"businessOrder"::text,
                'reversesEntryId',"reversesEntryId"::text,'isEffective',"isEffective",
                'createdAt',"createdAt",'productId',"productId"::text,'unitId',"unitId",
                'lineId',"lineId"::text,'quantityDelta',quantity::text,
                'balanceAfter',"balanceAfter"::text) AS data
              FROM ledger WHERE (CAST(:fromDate AS date) IS NULL OR "businessDate">=:fromDate)
                AND (CAST(:toDate AS date) IS NULL OR "businessDate"<:toDate)
                AND (CAST(:sourceDocumentId AS bigint) IS NULL
                  OR "sourceDocumentId"=:sourceDocumentId)
                AND (NOT :effectiveOnly OR "isEffective")
                AND (CAST(:cursorDate AS date) IS NULL OR ("businessDate","businessOrder",id)
                  {comparison} (CAST(:cursorDate AS date),CAST(:cursorOrder AS bigint),
                    CAST(:cursorId AS bigint)))
              ORDER BY "businessDate" {direction},"businessOrder" {direction},id {direction}
              LIMIT :fetch
            ) SELECT p.id::text AS "productId",p."unitId",
              coalesce((SELECT sum(quantity) FROM ledger
                WHERE "businessDate"<:fromDate),0) AS "openingStock",
              coalesce((SELECT sum(quantity) FROM ledger WHERE CAST(:toDate AS date) IS NULL
                OR "businessDate"<:toDate),0) AS "closingStock",
              coalesce((SELECT jsonb_agg(data ORDER BY "businessDate" {direction},
                "businessOrder" {direction},id {direction}) FROM page),'[]'::jsonb) AS items
            FROM dms.product p WHERE p.id=:product
        """),
                {"product": product_id, **parameters},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ApiError(404, "NOT_FOUND", "Product not found")
        return dict(row)

    def lock_balances(self, product_ids) -> None:
        for identifier in sorted(set(product_ids)):
            self.session.execute(
                text(
                    'SELECT "productId" FROM dms.inventory_balance WHERE "productId"=:id FOR UPDATE'
                ),
                {"id": identifier},
            ).one()

    def append(self, batch_id, lines, business_date, business_order, *, direction: int = 1) -> None:
        if direction not in (-1, 1):
            raise ValueError("Invalid inventory direction")
        for line in lines:
            self.session.execute(
                text("""
                INSERT INTO dms.inventory_entry
                  ("batchId","lineId","productId","unitId",quantity,"businessDate","businessOrder")
                VALUES (:batch,:line,:product,:unit,:quantity,:date,:ordering)
            """),
                {
                    "batch": batch_id,
                    "line": line["id"],
                    "product": line["productId"],
                    "unit": line["unitId"],
                    "quantity": direction * line["quantity"],
                    "date": business_date,
                    "ordering": business_order,
                },
            )

    def reverse_revision(self, revision_id: int, batch_id: int) -> list[int]:
        rows = (
            self.session.execute(
                text("""
            SELECT e.*,NOT EXISTS(SELECT 1 FROM dms.inventory_entry x
              WHERE x."reversesEntryId"=e.id) AS "isEffective"
            FROM dms.inventory_entry e JOIN dms.posting_batch b ON b.id=e."batchId"
            WHERE b."revisionId"=:revision AND e."reversesEntryId" IS NULL
            ORDER BY e."productId",e.id FOR UPDATE OF e
        """),
                {"revision": revision_id},
            )
            .mappings()
            .all()
        )
        identifiers = []
        for row in rows:
            values = reversal_values(dict(row), batch_id, value_field="quantity")
            identifiers.append(
                self.session.scalar(
                    text("""
                INSERT INTO dms.inventory_entry ("batchId","lineId","productId","unitId",
                  quantity,"businessDate","businessOrder","reversesEntryId")
                VALUES (:batchId,:lineId,:productId,:unitId,:quantity,:businessDate,
                  :businessOrder,:reversesEntryId) RETURNING id
            """),
                    values,
                )
            )
        return identifiers

    def changes(self, product_ids) -> list[InventoryChange]:
        return [
            InventoryChange.model_validate(dict(row))
            for row in self.session.execute(
                text("""
            SELECT id::text AS "productId","currentStock",
              "currentPurchasePrice","currentSellingPrice"
            FROM dms.inventory_overview WHERE id=ANY(:ids) ORDER BY id
        """),
                {"ids": sorted(set(product_ids))},
            ).mappings()
        ]
