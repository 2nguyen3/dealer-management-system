"""Owner deletion and balance guards of the rebuilt 0011 schema, at the database level.

Historical 0005/0006 cascade tests were retired with revision 0011 (it rebuilds schema
``dms`` and cannot be downgraded); these cases cover the same guarantees on 0011.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from tests.integration.catalogues.helpers import (
    agency,
    draft,
    install_builders,
    payment,
    post_stock,
    product,
)

pytestmark = pytest.mark.integration


def guard(engine, sql, params):
    with pytest.raises(DBAPIError) as error, engine.begin() as connection:
        connection.execute(text(sql), params)
    return error.value.orig.diag.constraint_name


def test_unused_owners_delete_and_used_owners_are_guarded(engine, actor):
    with Session(engine) as session:
        session.execute(text("INSERT INTO dms.unit (code,name) VALUES ('UNIT','Unit')"))
        unused_product, unused_agency = product(session), agency(session, ward=7)
        used_product, used_agency = product(session), agency(session, ward=8)
        install_builders(session, actor)
        post_stock(session, draft(session, used_product, quantity="5"))
        post_stock(session, draft(session, used_product, kind="STOCK_ISSUE", agency_id=used_agency))
        payment(session, used_agency, 102)
        session.commit()
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM dms.product WHERE id=:id"), {"id": unused_product})
        connection.execute(text("DELETE FROM dms.agency WHERE id=:id"), {"id": unused_agency})
    for table, identifier in (("product", used_product), ("agency", used_agency)):
        constraint = guard(engine, f"DELETE FROM dms.{table} WHERE id=:id", {"id": identifier})
        assert constraint == "ck_owner_eligible_deletion"
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.product WHERE id IN (:a, :b)"),
                {"a": unused_product, "b": used_product},
            )
            == 1
        )
        assert (
            connection.scalar(text("SELECT debt FROM dms.agency WHERE id=:id"), {"id": used_agency})
            == 0
        )
        assert (
            connection.scalar(
                text("SELECT stock FROM dms.product WHERE id=:id"), {"id": used_product}
            )
            == 4
        )


def test_balances_change_only_in_posting_context(engine, actor):
    with Session(engine) as session:
        session.execute(text("INSERT INTO dms.unit (code,name) VALUES ('UNIT','Unit')"))
        product_id, agency_id = product(session), agency(session)
        session.commit()
    assert (
        guard(engine, "UPDATE dms.product SET stock=5 WHERE id=:id", {"id": product_id})
        == "ck_product_balance_protected"
    )
    assert (
        guard(engine, "UPDATE dms.agency SET debt=5 WHERE id=:id", {"id": agency_id})
        == "ck_agency_debt_protected"
    )
    with engine.begin() as connection:
        # A catalogue function code is not a posting context either.
        connection.execute(text("SELECT set_config('dms.function_code','product.manage',true)"))
        with pytest.raises(DBAPIError):
            with connection.begin_nested():
                connection.execute(
                    text("UPDATE dms.product SET stock=5 WHERE id=:id"), {"id": product_id}
                )
    with pytest.raises(DBAPIError) as error, engine.begin() as connection:
        connection.execute(
            text(
                'INSERT INTO dms.product (name,"unitId",stock) '
                "SELECT 'Preloaded', id, 3 FROM dms.unit LIMIT 1"
            )
        )
    assert error.value.orig.diag.constraint_name == "ck_product_balance_protected"
