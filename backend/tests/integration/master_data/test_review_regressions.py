import time
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.modules.agencies.schemas import AgencyUpdate, Reason
from app.modules.agencies.service import AgencyService
from tests.integration.catalogues.helpers import draft, install_builders, post_stock
from tests.integration.catalogues.test_races import ordered_race
from tests.integration.master_data.test_contract import body_for
from tests.integration.master_data.test_races import service
from tests.support.database import race_timeout

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("leading", ["acceptance", "history"])
def test_acceptance_date_vs_existing_draft_history_both_orders(
    client, engine, actor, masters, leading
):
    agency = client.post("/api/v1/agencies", json=body_for("agencies", masters))
    product = client.post("/api/v1/products", json=body_for("products", masters))
    with Session(engine) as session:
        install_builders(session, actor)
        receipt = draft(session, int(product.json()["id"]), quantity="10")
        post_stock(session, receipt)
        issue = draft(
            session,
            int(product.json()["id"]),
            kind="STOCK_ISSUE",
            agency_id=int(agency.json()["id"]),
        )
        session.execute(
            text(
                "UPDATE dms.document_revision SET \"businessDate\"='2026-01-05' "
                'WHERE "documentId"=:id'
            ),
            {"id": issue},
        )
        session.commit()

    def acceptance(session):
        return service(AgencyService, session, actor).update(
            int(agency.json()["id"]),
            AgencyUpdate(acceptedDate="2026-01-03"),
            Preconditions(agency.headers["ETag"]),
        )

    def history(session):
        session.execute(
            text(
                "UPDATE dms.document_revision SET \"businessDate\"='2026-01-02' "
                'WHERE "documentId"=:id'
            ),
            {"id": issue},
        )
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        return "history-updated"

    first, second = ordered_race(
        engine,
        acceptance if leading == "acceptance" else history,
        history if leading == "acceptance" else acceptance,
    )
    if leading == "acceptance":
        assert str(first.acceptedDate) == "2026-01-03" and second == "23514"
    else:
        assert first == "history-updated" and second == "AGENCY_CONFLICT"
    with engine.connect() as c:
        assert (
            c.exec_driver_sql(
                'SELECT count(*) FROM dms.agency a JOIN dms.document d ON d."agencyId"=a.id '
                'JOIN dms.document_revision r ON r."documentId"=d.id '
                'WHERE r."businessDate"<a."acceptedDate"'
            ).scalar()
            == 0
        )


def test_termination_replay_reauthorizes_after_command_claim_wait(client, engine, actor, masters):
    agency = client.post("/api/v1/agencies", json=body_for("agencies", masters))
    key = uuid4()
    acquired, release = Event(), Event()

    def original():
        with Session(engine) as session:
            commit = session.commit

            def delayed():
                acquired.set()
                assert release.wait(race_timeout(10))
                commit()

            with patch.object(session, "commit", side_effect=delayed):
                return service(AgencyService, session, actor).terminate(
                    int(agency.json()["id"]),
                    Reason(reason="End"),
                    Preconditions(agency.headers["ETag"]),
                    key,
                )

    with ThreadPoolExecutor(2) as pool:
        first = pool.submit(original)
        assert acquired.wait(race_timeout(10))
        replay = pool.submit(
            client.post,
            agency.headers["Location"] + "/terminate",
            json={"reason": "End"},
            headers={"If-Match": agency.headers["ETag"], "Idempotency-Key": str(key)},
        )
        try:
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as c:
                deadline = time.monotonic() + race_timeout(5)
                while time.monotonic() < deadline:
                    if c.scalar(
                        text(
                            "SELECT pid FROM pg_stat_activity WHERE datname=:db "
                            "AND wait_event_type='Lock' AND query LIKE '%api_idempotency%'"
                        ),
                        {"db": engine.url.database},
                    ):
                        break
                    Event().wait(0.01)
                else:
                    pytest.fail("Expected command claim wait")
            with engine.begin() as c:
                c.exec_driver_sql(
                    'UPDATE dms.group_permission SET "isAllowed"=false WHERE "groupId"=1 '
                    'AND "functionId"=(SELECT id FROM dms.app_function '
                    "WHERE code='agency.manage')"
                )
        finally:
            release.set()
        assert first.result(timeout=race_timeout(15)).body["status"] == "TERMINATED"
        denied = replay.result(timeout=race_timeout(15))
        assert denied.status_code == 403, denied.text
    with engine.connect() as c:
        assert c.exec_driver_sql("SELECT count(*) FROM dms.api_idempotency").scalar() == 1
