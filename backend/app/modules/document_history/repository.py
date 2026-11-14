"""Cross-kind reads over the shared document projection. Repositories never commit."""

from sqlalchemy import text

from app.modules.document_core.models import DOCUMENT
from app.modules.document_core.repository import DocumentRepository


def kind_in(column, kinds):
    return column.in_(kinds)


# Walk back to the original through replacesDocumentId, then forward through successors.
# Corrections insert the replacement after the original, so ids strictly increase along
# a chain; the depth bound only guards against hand-edited data.
CHAIN_SQL = """
WITH RECURSIVE back AS (
  SELECT id, "replacesDocumentId", 0 AS depth FROM dms.document WHERE id = :id
  UNION ALL
  SELECT d.id, d."replacesDocumentId", b.depth - 1
  FROM dms.document d JOIN back b ON d.id = b."replacesDocumentId"
  WHERE b.depth > -1000
), forward AS (
  SELECT id, 0 AS depth FROM dms.document WHERE id = :id
  UNION ALL
  SELECT d.id, f.depth + 1
  FROM dms.document d JOIN forward f ON d."replacesDocumentId" = f.id
  WHERE f.depth < 1000
)
SELECT id FROM (
  SELECT id, depth FROM back UNION SELECT id, depth FROM forward
) chain ORDER BY depth
"""


class HistoryRepository(DocumentRepository):
    """The document_core list projection without a kind, restricted to readable kinds."""

    ranges = {**DocumentRepository.ranges, "kinds": (DOCUMENT.c.kind, kind_in)}

    def __init__(self, session) -> None:
        super().__init__(session, None)

    def chain_ids(self, identifier: int) -> list[int]:
        return list(self.session.execute(text(CHAIN_SQL), {"id": identifier}).scalars())

    def summaries(self, identifiers: list[int]) -> dict[int, dict]:
        rows = (
            self.session.execute(
                self.query()
                .add_columns(DOCUMENT.c.cancelReason.label("cancelReason"))
                .where(DOCUMENT.c.id.in_(identifiers))
            )
            .mappings()
            .all()
        )
        return {int(row["id"]): dict(row) for row in rows}
