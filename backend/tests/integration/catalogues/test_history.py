from unittest.mock import patch

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import ApiError
from app.db.manifest import COMPATIBLE_HEAD
from app.db.seed import main as seed_main
from app.db.verify import check_database
from tests.integration.catalogues.helpers import (
    agency,
    draft,
    install_builders,
    post_stock,
    product,
    service_for,
)
from tests.integration.catalogues.test_state import create_body, precondition, update_body

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
        posted = session.execute(
            text(
                'SELECT "totalAmount","sellingPriceRate","updatedAt" FROM dms.document WHERE id=:id'
            ),
            {"id": issue},
        ).one()
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
                {"agencyId": str(agency_id), "agencyCode": f"DL-{agency_id}", "debt": "102"}
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
            # The posted issue keeps its frozen total and rate; limits are not snapshots.
            assert (
                connection.execute(
                    text(
                        'SELECT "totalAmount","sellingPriceRate","updatedAt" '
                        "FROM dms.document WHERE id=:id"
                    ),
                    {"id": issue},
                ).one()
                == posted
            )
            assert posted.totalAmount == 102


def test_seeded_catalogue_history_guards_and_line_snapshots(database_factory):
    settings = Settings(_env_file=None, db_host="test", db_user="test", db_password="test")
    with database_factory() as engine:
        with (
            patch("app.db.seed.build_engine", return_value=engine),
            patch("app.db.seed.get_settings", return_value=settings),
        ):
            seed_main()
        with engine.connect() as connection:
            first = check_database(connection, seeded=True)
            lines = connection.execute(
                text('SELECT id,"productName","unitName" FROM dms.document_line ORDER BY id')
            ).all()
            documents = connection.execute(
                text(
                    'SELECT id,"totalAmount","sellingPriceRate",status FROM dms.document ORDER '
                    "BY id"
                )
            ).all()
            actor = connection.scalar(text("SELECT id FROM dms.app_user ORDER BY id LIMIT 1"))
        with Session(engine) as session:
            for resource, table in (("agency-types", "agency_type"), ("units", "unit")):
                identifier = session.scalar(
                    text(
                        f"SELECT min(t.id) FROM dms.{table} t WHERE EXISTS (SELECT 1 FROM "
                        + (
                            'dms.agency a WHERE a."typeId"=t.id)'
                            if table == "agency_type"
                            else 'dms.document_line l WHERE l."unitId"=t.id)'
                        )
                    )
                )
                service = service_for(resource, session, actor)
                with pytest.raises(ApiError, match="RESOURCE_IN_USE"):
                    service.delete(identifier, precondition(service, identifier))
                renamed = service.update(
                    identifier,
                    update_body(resource, {"name": "Đổi tên " + resource}),
                    precondition(service, identifier),
                )
                assert renamed.name == "Đổi tên " + resource
                if resource == "units":
                    with pytest.raises(ApiError, match="MASTER_CONFLICT"):
                        service.update(
                            identifier,
                            update_body(resource, {"allowsFraction": not renamed.allowsFraction}),
                            precondition(service, identifier),
                        )
            # Renaming masters never rewrites recorded document snapshots.
            assert (
                session.execute(
                    text('SELECT id,"productName","unitName" FROM dms.document_line ORDER BY id')
                ).all()
                == lines
            )
            assert (
                session.execute(
                    text(
                        'SELECT id,"totalAmount","sellingPriceRate",status '
                        "FROM dms.document ORDER BY id"
                    )
                ).all()
                == documents
            )
        with engine.connect() as connection:
            assert check_database(connection, seeded=False)["document"] == first["document"]
            assert (
                connection.scalar(text("SELECT version_num FROM public.alembic_version"))
                == COMPATIBLE_HEAD
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
