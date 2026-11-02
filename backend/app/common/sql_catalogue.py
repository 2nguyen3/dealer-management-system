"""DML for explicitly described, SQL-owned tables without duplicate ORM mappings."""

from types import SimpleNamespace

from sqlalchemy import delete, insert, select, update

from app.common.catalogue import CatalogueRepository


class SqlCatalogueRepository(CatalogueRepository):
    table = None

    def create(self, values: dict) -> int:
        return self.session.scalar(insert(self.table).values(**values).returning(self.table.c.id))

    def lock(self, identifier: int):
        row = (
            self.session.execute(
                select(self.table).where(self.table.c.id == identifier).with_for_update()
            )
            .mappings()
            .one_or_none()
        )
        return None if row is None else SimpleNamespace(**dict(row))

    def update(self, identifier: int, values: dict) -> None:
        self.session.execute(
            update(self.table).where(self.table.c.id == identifier).values(**values)
        )

    def delete(self, identifier: int) -> None:
        self.session.execute(delete(self.table).where(self.table.c.id == identifier))
