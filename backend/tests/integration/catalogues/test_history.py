from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import ApiError
from app.db.seed import main as seed_main
from app.db.verify import check_database, run_regression
from tests.integration.catalogues.helpers import (
    agency,
    draft,
    install_builders,
    post_stock,
    product,
    service_for,
)
from tests.integration.catalogues.test_state import create_body, precondition, update_body
from tests.support.database import migrate

pytestmark = pytest.mark.integration


def test_exact_debt_equality_one_over_terminated_blocker_and_snapshots(engine, actor):
    with Session(engine) as session:
        service = service_for("agency-types", session, actor)
        item = service.create(
            create_body(service, {"code": "TARGET", "name": "Target", "maxDebt": "1000"})
        )
        install_builders(session, actor)
        session.execute(text("INSERT INTO dms.unit (code,name) VALUES ('PIECE','Piece')"))
        product_id = product(session)
        agency_id = agency(session, type_id=item.id)
        receipt = draft(session, product_id, quantity="10")
        post_stock(session, receipt)
        issue = draft(session, product_id, kind="STOCK_ISSUE", agency_id=agency_id)
        post_stock(session, issue)
        session.execute(
            text(
                "UPDATE dms.agency SET status='TERMINATED',\"terminatedAt\"=clock_timestamp(),"
                "\"terminationReason\"='End' WHERE id=:id"
            ),
            {"id": agency_id},
        )
        session.commit()
        snapshot = session.scalar(
            text(
                'SELECT "maxDebtSnapshot" FROM dms.document_revision r '
                'JOIN dms.document d ON d."currentRevisionId"=r.id WHERE d.id=:id'
            ),
            {"id": issue},
        )
        # Current quote is 100*1.02 = 102 VND.
        updated = service.update(
            item.id, update_body("agency-types", {"maxDebt": "102"}), precondition(service, item.id)
        )
        assert (
            updated.maxDebt == 102 and updated.agencyCount == 1 and updated.activeAgencyCount == 0
        )
        before_audit = session.scalar(text("SELECT count(*) FROM dms.audit_log"))
        with pytest.raises(ApiError) as error:
            service.update(
                item.id,
                update_body("agency-types", {"maxDebt": "101"}),
                precondition(service, item.id),
            )
        assert error.value.code == "DEBT_LIMIT_BELOW_CURRENT_BALANCE"
        assert error.value.details == {
            "typeId": item.id,
            "requestedMaxDebt": "101",
            "blockingAgencies": [
                {"agencyId": str(agency_id), "agencyCode": f"DL-{agency_id}", "currentDebt": "102"}
            ],
        }
        with engine.connect() as connection:
            assert (
                connection.scalar(
                    text('SELECT "maxDebt" FROM dms.agency_type WHERE id=:id'), {"id": item.id}
                )
                == 102
            )
            assert connection.scalar(text("SELECT count(*) FROM dms.audit_log")) == before_audit
            assert (
                connection.scalar(
                    text(
                        'SELECT "maxDebtSnapshot" FROM dms.document_revision r '
                        'JOIN dms.document d ON d."currentRevisionId"=r.id WHERE d.id=:id'
                    ),
                    {"id": issue},
                )
                == snapshot
                == 1000
            )


def test_fresh_populated_upgrade_seed_repeat_and_catalogue_history(database_factory):
    settings = Settings(_env_file=None, db_host="test", db_user="test", db_password="test")
    with database_factory("0004") as engine:
        # Populate at the old reviewed head, then verify additive upgrade preserves everything.
        with (
            patch("app.db.manifest.COMPATIBLE_HEAD", "0004"),
            patch("app.db.seed.build_engine", return_value=engine),
            patch("app.db.seed.get_settings", return_value=settings),
        ):
            seed_main()
        migrate(engine.url)
        with engine.connect() as connection:
            first = check_database(connection, seeded=True)
            assert first["document"] == 410 and first["agency"] == 30
            historical = connection.execute(
                text(
                    'SELECT id,"maxDebtSnapshot","agencyName" '
                    "FROM dms.document_revision ORDER BY id"
                )
            ).all()
            lines = connection.execute(
                text('SELECT id,"productName","unitName" FROM dms.document_line ORDER BY id')
            ).all()
            actor = connection.scalar(text("SELECT id FROM dms.app_user ORDER BY id LIMIT 1"))
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch("app.db.seed.get_settings", return_value=settings),
        ):
            seed_main()
        with engine.connect() as connection:
            assert check_database(connection, seeded=True) == first
            connection.rollback()
            with connection.begin() as transaction:
                assert run_regression(connection) == 54
                transaction.rollback()
        with Session(engine) as session:
            for resource, table in (
                ("districts", "district"),
                ("agency-types", "agency_type"),
                ("units", "unit"),
            ):
                identifier = session.scalar(text(f"SELECT id FROM dms.{table} ORDER BY id LIMIT 1"))
                service = service_for(resource, session, actor)
                with pytest.raises(ApiError, match="RESOURCE_IN_USE"):
                    service.delete(identifier, precondition(service, identifier))
                renamed = service.update(
                    identifier,
                    update_body(resource, {"name": "Historical rename " + resource}),
                    precondition(service, identifier),
                )
                assert renamed.name.startswith("Historical rename")
                if resource == "units":
                    with pytest.raises(ApiError, match="MASTER_CONFLICT"):
                        service.update(
                            identifier,
                            update_body(resource, {"allowsFraction": not renamed.allowsFraction}),
                            precondition(service, identifier),
                        )
            assert (
                session.execute(
                    text(
                        'SELECT id,"maxDebtSnapshot","agencyName" '
                        "FROM dms.document_revision ORDER BY id"
                    )
                ).all()
                == historical
            )
            assert (
                session.execute(
                    text('SELECT id,"productName","unitName" FROM dms.document_line ORDER BY id')
                ).all()
                == lines
            )
        migrate(engine.url, "0004", downgrade=True)
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT to_regprocedure('dms.lock_recorded_unit_policy()')"))
                is None
            )
        migrate(engine.url)
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM public.alembic_version")) == "0007"
            )


def test_migration_direct_database_recorded_policy_guard(engine, actor):
    with Session(engine) as session:
        install_builders(session, actor)
        session.execute(text("INSERT INTO dms.unit (code,name) VALUES ('PIECE','Piece')"))
        product_id = product(session)
        draft(session, product_id)
        session.commit()
        with pytest.raises(IntegrityError) as error:
            session.execute(text('UPDATE dms.unit SET "allowsFraction"=true WHERE id=1'))
        assert error.value.orig.diag.constraint_name == "ck_unit_recorded_fraction_policy"
        session.rollback()
        assert session.scalar(text('SELECT "allowsFraction" FROM dms.unit WHERE id=1')) is False
