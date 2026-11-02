from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.modules.document_core.repository import DocumentRepository
from tests.integration.settlement_core.helpers import commit, financial, issue, service
from tests.support.database import migrate

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("retired", ["product", "agency"])
def test_0008_historical_issue_successor_reproduces_d15(engine, actor, trading, retired):
    migrate(engine.url, "0008", downgrade=True)
    with Session(engine) as session:
        identifier = issue(session, actor, trading)
        receipt = financial(session, actor, trading[0], 102)
        service(session, actor).post_receipt(receipt, uuid4())
        commit(session)
        if retired == "product":
            session.execute(
                text("UPDATE dms.product SET status='INACTIVE' WHERE id=:id"), {"id": trading[1]}
            )
        else:
            session.execute(
                text("""UPDATE dms.agency SET status='TERMINATED',
                "terminatedAt"=clock_timestamp(),"terminationReason"='Stopped trading'
                WHERE id=:id"""),
                {"id": trading[0]},
            )
        session.commit()
        repo = DocumentRepository(session)
        old = repo.revision(identifier, 1)
        revision = repo.new_revision(
            identifier,
            date(2026, 1, 2),
            "Recorded quantity error",
            actor,
            **{
                name: old[name]
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
        for line in repo.lines(old["id"]):
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
        with pytest.raises(DBAPIError) as error:
            session.execute(
                text("""UPDATE dms.document_revision SET state='POSTED',
                "postedBy"=:actor,"postedAt"=clock_timestamp() WHERE id=:id"""),
                {"actor": actor, "id": revision},
            )
        assert error.value.orig.sqlstate == "23514"
        assert ("inactive products/units" if retired == "product" else "terminated agency") in str(
            error.value.orig
        )
        session.rollback()
        assert repo.document(identifier)["currentRevisionId"] == old["id"]
