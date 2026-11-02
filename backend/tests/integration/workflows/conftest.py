import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.integration.catalogues.helpers import agency, install_builders, product
from tests.integration.user_groups.conftest import (  # noqa: F401
    actor,
    client,
    database_factory,
    engine,
)


@pytest.fixture
def trading(engine, actor):  # noqa: F811
    with Session(engine) as session:
        install_builders(session, actor)
        agency_id = agency(session)
        unit = session.scalar(
            text("INSERT INTO dms.unit (code,name) VALUES ('PCS','Piece') RETURNING id")
        )
        product_id = product(session, unit)
        receipt = session.scalar(
            text("""
            SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-01',
              jsonb_build_array(jsonb_build_object('product',CAST(:id AS bigint),
                'quantity',100,'price',100)),gen_random_uuid())
        """),
            {"id": product_id},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": receipt})
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        return {"agency": str(agency_id), "product": str(product_id), "unit": unit}
