import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.catalogues.helpers import agency, install_builders, product
from tests.integration.user_groups.conftest import actor, database_factory, engine  # noqa: F401


@pytest.fixture
def trading(engine, actor):  # noqa: F811
    with Session(engine) as session:
        install_builders(session, actor)
        agency_id = agency(session)
        unit_id = session.scalar(
            text("INSERT INTO dms.unit (code,name) VALUES ('PCS','Piece') RETURNING id")
        )
        product_id = product(session, unit_id)
        opening = session.scalar(
            text("""
            SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-01',
              jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
                'quantity',1000,'price',100)),gen_random_uuid())
        """),
            {"product": product_id},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": opening})
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        return agency_id, product_id
