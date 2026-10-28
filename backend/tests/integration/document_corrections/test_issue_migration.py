from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.db.seed import main as seed_demo
from app.db.verify import check_database, run_regression
from app.modules.document_core.repository import DocumentRepository
from tests.integration.catalogues.helpers import install_builders, product
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.settlement_core.helpers import commit, financial, issue, service
from tests.support.database import migrate

pytestmark = pytest.mark.integration


def revision_guard(engine, expected_head):
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM public.alembic_version")) == (
            expected_head
        )
        return connection.scalar(
            text("SELECT pg_get_functiondef('dms.guard_revision()'::regprocedure)")
        )


def probe_posted_transition(engine, actor, identifier, *, line_source=None, denied=None):
    before = snapshot(engine)
    with Session(engine) as session:
        install_builders(session, actor)
        repo = DocumentRepository(session)
        original = repo.revision(identifier, 1)
        if original["state"] == "POSTED":
            revision = repo.new_revision(
                identifier,
                original["businessDate"],
                "Migration admission probe",
                actor,
                **{
                    name: original[name]
                    for name in (
                        "totalAmount",
                        "immediatePayment",
                        "sellingPriceRate",
                        "maxDebtSnapshot",
                        "agencyName",
                        "agencyAddress",
                        "agencyPhone",
                        "agencyEmail",
                    )
                },
            )
            source = repo.revision(line_source or identifier, 1)
            for line in repo.lines(source["id"]):
                repo.put_line(
                    revision,
                    {
                        name: line[name]
                        for name in (
                            "productId",
                            "unitId",
                            "productName",
                            "unitName",
                            "quantity",
                            "unitPrice",
                            "basePurchasePrice",
                        )
                    },
                )
            session.execute(
                text("""UPDATE dms.document_revision SET state='READY',
                "readyBy"=:actor,"readyAt"=clock_timestamp() WHERE id=:id"""),
                {"actor": actor, "id": revision},
            )
        else:
            assert original["state"] == "READY"
            revision = original["id"]
        transition = text("""UPDATE dms.document_revision SET state='POSTED',
            "postedBy"=:actor,"postedAt"=clock_timestamp() WHERE id=:id""")
        if denied is None:
            session.execute(transition, {"actor": actor, "id": revision})
            assert (
                session.scalar(
                    text("SELECT state FROM dms.document_revision WHERE id=:id"), {"id": revision}
                )
                == "POSTED"
            )
        else:
            with pytest.raises(DBAPIError) as error:
                session.execute(transition, {"actor": actor, "id": revision})
            assert error.value.orig.sqlstate == "23514"
            assert denied in str(error.value.orig)
        # Probe the immediate admission trigger only, without fabricating posting ledgers.
        session.rollback()
    assert snapshot(engine) == before


def test_0009_fresh_schema_downgrade_reupgrade_restores_guard(database_factory):
    with database_factory("0009") as engine:
        before = snapshot(engine)
        upgraded = revision_guard(engine, "0009")
        migrate(engine.url, "0008", downgrade=True)
        assert revision_guard(engine, "0008") != upgraded
        assert snapshot(engine) == before
        migrate(engine.url, "0009")
        assert revision_guard(engine, "0009") == upgraded
        assert snapshot(engine) == before


def test_0009_populated_seed_roundtrip_preserves_rows_and_54_regressions(database_factory):
    with database_factory("0008") as engine:
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch(
                "app.db.seed.get_settings",
                return_value=SimpleNamespace(database_url=lambda: engine.url),
            ),
        ):
            with patch("app.db.manifest.COMPATIBLE_HEAD", "0008"):
                seed_demo()
            before = snapshot(engine)
            assert any(row["revisionNo"] > 1 for row in before["document_revision"])
            predecessor = revision_guard(engine, "0008")
            migrate(engine.url, "0009")
            upgraded = revision_guard(engine, "0009")
            assert upgraded != predecessor and snapshot(engine) == before
            seed_demo()
            seed_demo()
            assert snapshot(engine) == before
            migrate(engine.url, "0008", downgrade=True)
            assert revision_guard(engine, "0008") == predecessor
            assert snapshot(engine) == before
            migrate(engine.url, "0009")
            assert revision_guard(engine, "0009") == upgraded
            assert snapshot(engine) == before
            seed_demo()
            assert snapshot(engine) == before
        with engine.connect() as connection:
            counts = check_database(connection, seeded=True)
            assert counts["document"] == 410 and counts["product"] == 24 and counts["agency"] == 30
            connection.rollback()
            assert run_regression(connection) == 54
            connection.rollback()
        assert snapshot(engine) == before


@pytest.mark.parametrize("retired", ["product", "unit", "agency"])
def test_0009_admission_is_same_document_only_and_downgrade_restores_denial(
    engine, actor, trading, retired
):
    migrate(engine.url, "0008", downgrade=True)
    with Session(engine) as session:
        original = issue(session, actor, trading)
        unit = session.scalar(
            text("INSERT INTO dms.unit (code,name) VALUES ('OTHER','Other unit') RETURNING id")
        )
        other_product = product(session, unit)
        opening = session.scalar(
            text("""SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-01',
            jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),
              'quantity',10,'price',100)),gen_random_uuid())"""),
            {"product": other_product},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": opening})
        commit(session)
        other_issue = issue(session, actor, (trading[0], other_product))
        first_post = issue(session, actor, (trading[0], other_product), post=False)
        receipt = financial(session, actor, trading[0], 204)
        service(session, actor).post_receipt(receipt, uuid4())
        commit(session)
        if retired == "product":
            session.execute(
                text("UPDATE dms.product SET status='INACTIVE' WHERE id=ANY(:ids)"),
                {"ids": [trading[1], other_product]},
            )
        elif retired == "unit":
            session.execute(
                text("""UPDATE dms.unit SET status='INACTIVE' WHERE id IN
                (SELECT "unitId" FROM dms.product WHERE id=ANY(:ids))"""),
                {"ids": [trading[1], other_product]},
            )
        else:
            session.execute(
                text("""UPDATE dms.agency SET status='TERMINATED',
                "terminatedAt"=clock_timestamp(),"terminationReason"='Stopped trading'
                WHERE id=:id"""),
                {"id": trading[0]},
            )
        commit(session)
    before = snapshot(engine)
    migrate(engine.url, "0009")
    upgraded = revision_guard(engine, "0009")
    assert snapshot(engine) == before
    probe_posted_transition(engine, actor, original)
    denial = "terminated agency" if retired == "agency" else "inactive products/units"
    # The pending document cannot borrow the other issue's POSTED product/agency history.
    probe_posted_transition(engine, actor, first_post, denied=denial)
    if retired != "agency":
        probe_posted_transition(engine, actor, original, line_source=other_issue, denied=denial)
    migrate(engine.url, "0008", downgrade=True)
    revision_guard(engine, "0008")
    assert snapshot(engine) == before
    probe_posted_transition(engine, actor, original, denied=denial)
    migrate(engine.url, "0009")
    assert revision_guard(engine, "0009") == upgraded
    assert snapshot(engine) == before
    probe_posted_transition(engine, actor, original)
