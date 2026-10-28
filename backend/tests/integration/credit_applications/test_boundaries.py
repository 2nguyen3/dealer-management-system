from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from tests.integration.credit_applications.test_service import create, service
from tests.integration.settlement_core.helpers import commit, issue
from tests.integration.settlement_core.test_reservations import credit_cash

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("failure", ["credit", "commit"])
def test_one_over_credit_and_definite_commit_failure_restore_entire_post(
    engine, actor, trading, failure
):
    agency, product = int(trading["agency"]), int(trading["product"])
    with Session(engine) as session:
        credit_cash(session, actor, (agency, product), 100)
        issue(session, actor, (agency, product), day=4, quantity=2)
        commit(session)
        use = service(session, actor)
        created = create(use, agency, "101" if failure == "credit" else "100")
        key = uuid4()
        identifier = int(created.body["id"])
        with engine.connect() as connection:
            before = connection.execute(
                text("SELECT to_jsonb(e) FROM dms.credit_entry e ORDER BY id")
            ).all()
            commands = connection.scalar(text("SELECT count(*) FROM dms.api_idempotency"))
        if failure == "credit":
            with pytest.raises(ApiError, match="INSUFFICIENT_CREDIT"):
                use.post(identifier, Preconditions(created.headers["ETag"]), key)
        else:
            # Failure before issuing COMMIT is definite rollback, unlike a lost reply.
            with patch.object(
                session, "commit", side_effect=RuntimeError("definite-before-commit")
            ):
                with pytest.raises(RuntimeError, match="definite-before-commit"):
                    use.post(identifier, Preconditions(created.headers["ETag"]), key)
        with engine.connect() as connection:
            assert (
                connection.execute(
                    text("SELECT to_jsonb(e) FROM dms.credit_entry e ORDER BY id")
                ).all()
                == before
            )
            assert connection.scalar(text("SELECT count(*) FROM dms.api_idempotency")) == commands
            assert (
                connection.scalar(
                    text("SELECT status FROM dms.document WHERE id=:id"), {"id": identifier}
                )
                == "DRAFT"
            )
            assert (
                connection.scalar(
                    text("SELECT count(*) FROM dms.receivable_entry WHERE kind='CREDIT'")
                )
                == 0
            )
        if failure == "commit":
            retry = use.post(identifier, Preconditions(created.headers["ETag"]), key)
            assert retry.body["agencyBalance"]["currentCredit"] == "0"
