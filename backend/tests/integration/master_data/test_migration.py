from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.seed import main as seed_main
from app.db.verify import check_database, run_regression
from tests.integration.catalogues.helpers import agency, product
from tests.support.database import migrate

pytestmark = pytest.mark.integration


def test_d02_reproduction_upgrade_cascade_rollback_and_downgrade(database_factory):
    with database_factory("0005") as engine:
        with Session(engine) as session:
            session.execute(text("INSERT INTO dms.unit(code,name) VALUES ('UNIT','Unit')"))
            product_id = product(session)
            agency_id = agency(session)
            session.commit()
        for table, identifier in (("product", product_id), ("agency", agency_id)):
            with pytest.raises(DBAPIError), engine.begin() as c:
                c.execute(text(f"DELETE FROM dms.{table} WHERE id=:id"), {"id": identifier})
        migrate(engine.url)
        for table, cache, owner, identifier in (
            ("product", "inventory_balance", "productId", product_id),
            ("agency", "agency_balance", "agencyId", agency_id),
        ):
            with engine.connect() as c:
                transaction = c.begin()
                c.execute(text(f"DELETE FROM dms.{table} WHERE id=:id"), {"id": identifier})
                assert (
                    c.execute(
                        text(f'SELECT count(*) FROM dms.{cache} WHERE "{owner}"=:id'),
                        {"id": identifier},
                    ).scalar()
                    == 0
                )
                transaction.rollback()
            with engine.connect() as c:
                assert (
                    c.execute(
                        text(f"SELECT count(*) FROM dms.{table} WHERE id=:id"), {"id": identifier}
                    ).scalar()
                    == 1
                )
            with engine.begin() as c:
                c.execute(text(f"DELETE FROM dms.{table} WHERE id=:id"), {"id": identifier})
        migrate(engine.url, "0005", downgrade=True)
        with Session(engine) as session:
            new = product(session)
            session.commit()
        with pytest.raises(DBAPIError), engine.begin() as c:
            c.execute(text("DELETE FROM dms.product WHERE id=:id"), {"id": new})
        migrate(engine.url)
        with engine.begin() as c:
            c.execute(text("DELETE FROM dms.product WHERE id=:id"), {"id": new})


def test_populated_upgrade_seed_regression_and_snapshot_preservation(database_factory):
    settings = Settings(_env_file=None, db_host="test", db_user="test", db_password="test")
    with database_factory("0005") as engine:
        with (
            patch("app.db.manifest.COMPATIBLE_HEAD", "0005"),
            patch("app.db.seed.build_engine", return_value=engine),
            patch("app.db.seed.get_settings", return_value=settings),
        ):
            seed_main()
        with engine.connect() as c:
            snapshots = c.exec_driver_sql(
                'SELECT id,"unitPrice","productName","unitName" FROM dms.document_line ORDER BY id'
            ).all()
        migrate(engine.url)
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch("app.db.seed.get_settings", return_value=settings),
        ):
            seed_main()
            seed_main()
        with engine.connect() as c:
            assert check_database(c, seeded=True)["document"] == 410
            assert (
                c.exec_driver_sql(
                    'SELECT id,"unitPrice","productName","unitName" '
                    "FROM dms.document_line ORDER BY id"
                ).all()
                == snapshots
            )
            c.rollback()
            with c.begin() as transaction:
                assert run_regression(c) == 54
                transaction.rollback()
        migrate(engine.url, "0005", downgrade=True)
        migrate(engine.url)
        with engine.connect() as c:
            assert c.exec_driver_sql("SELECT version_num FROM alembic_version").scalar() == "0007"
