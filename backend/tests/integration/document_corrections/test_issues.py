from datetime import date
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.pagination import CursorCodec
from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError, AuthError
from app.modules.document_corrections.issues import IssueCorrectionService
from app.modules.stock_issues.schemas import StockIssueCorrection
from app.modules.stock_issues.service import StockIssueService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.catalogues.helpers import install_builders
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.manual_helpers import timeline
from tests.integration.settlement_core.helpers import (
    commit,
    financial,
    issue,
)
from tests.integration.settlement_core.helpers import (
    service as settlement,
)
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def use_case(session, actor, authorize=lambda _: None):
    return IssueCorrectionService(
        StockIssueService(session, CursorCodec(b"x" * 32), actor, "m29-issue", authorize)
    )


def token(engine, actor, identifier):
    with Session(engine) as session:
        owner = use_case(session, actor).owner
        return Preconditions(owner.etag(owner.core.get(identifier, check_permission=False)))


def replacement(product, quantity="3", **values):
    return StockIssueCorrection.model_validate(
        {
            "businessDate": "2026-01-02",
            "reason": "Wrong original quantity",
            "lines": [{"productId": str(product), "quantity": quantity}],
            **values,
        }
    )


def ready_with_money(engine, actor, trading, *, posted):
    with Session(engine) as session:
        install_builders(session, actor)
        identifier = session.scalar(
            text("""SELECT pg_temp.stock_draft('STOCK_ISSUE',:agency,DATE '2026-01-02',
            jsonb_build_array(jsonb_build_object('product',CAST(:product AS bigint),'quantity',3)),
            gen_random_uuid())"""),
            {"agency": trading[0], "product": trading[1]},
        )
        session.execute(text("SELECT pg_temp.ready(:id,40)"), {"id": identifier})
        revision = use_case(session, actor).core.repo.document(identifier)["currentRevisionId"]
        session.execute(
            text("""INSERT INTO dms.upfront_confirmation
            ("issueRevisionId",amount,method,"receivedAt","verifiedBy","evidenceReference")
            VALUES (:revision,40,'CASH',TIMESTAMPTZ '2026-01-02 10:00:00+07',:actor,
            'm29-upfront')"""),
            {"revision": revision, "actor": actor},
        )
        commit(session)
        if posted:
            use_case(session, actor).owner.post(
                identifier, token(engine, actor, identifier), uuid4()
            )
        return identifier


def test_issue_correction_preserves_prices_and_replays_later_cash(engine, actor, trading):
    invoices, _ = timeline(engine, actor, trading)
    identifier = invoices[0]
    before = snapshot(engine)
    with engine.begin() as connection:
        connection.execute(text('UPDATE dms.business_rule SET "sellingPriceRate"=2 WHERE id'))
    old_token, key = token(engine, actor, identifier), uuid4()
    with Session(engine) as session:
        service = use_case(session, actor)
        result = service.correct(identifier, replacement(trading[1]), old_token, key)
        assert_schema(result.body, "DocumentMutationResult")
        assert result.body["totalAmount"] == "306"
        assert result.body["agencyBalance"]["currentDebt"] == "164"
        assert result.body["inventoryChanges"][0]["currentStock"] == "993"
        assert service.correct(identifier, replacement(trading[1]), old_token, key) == result
    after = snapshot(engine)
    assert after["document_revision"][:-1] == before["document_revision"]
    assert after["document_line"][:-1] == before["document_line"]
    assert (
        after["document_revision"][-1]["sellingPriceRate"]
        == before["document_revision"][1]["sellingPriceRate"]
    )
    before = after
    for body in (replacement(trading[1], "1"), replacement(trading[1], businessDate="2026-01-08")):
        with Session(engine) as session, pytest.raises(ApiError) as error:
            use_case(session, actor).correct(
                identifier, body, token(engine, actor, identifier), uuid4()
            )
        assert error.value.code == "PAYMENT_EXCEEDS_DEBT"
        assert snapshot(engine) == before


@pytest.mark.parametrize("posted", [False, True])
def test_upfront_issue_correct_date_and_cancel_preserve_all_real_money(
    engine, actor, trading, posted
):
    identifier = ready_with_money(engine, actor, trading, posted=posted)
    if posted:
        with Session(engine) as session:
            corrected = use_case(session, actor).correct(
                identifier,
                replacement(trading[1], businessDate="2026-01-03"),
                token(engine, actor, identifier),
                uuid4(),
            )
            assert corrected.body["immediatePayment"] == "40"
            auto = use_case(session, actor).core.repo.document(int(corrected.body["autoReceiptId"]))
            assert use_case(session, actor).core.repo.revision(auto["id"], 2)[
                "businessDate"
            ] == date(2026, 1, 3)
    key, condition = uuid4(), token(engine, actor, identifier)
    with Session(engine) as session:
        service = use_case(session, actor)
        result = service.cancel(identifier, Reason(reason="No delivery"), condition, key)
        assert result.body["status"] == "CANCELLED" and result.body["separateReceiptId"] is not None
        assert result.body["agencyBalance"]["currentDebt"] == "0"
        assert result.body["agencyBalance"]["currentCredit"] == "40"
        assert service.cancel(identifier, Reason(reason="No delivery"), condition, key) == result
    with engine.connect() as connection:
        assert (
            connection.scalar(
                text("SELECT count(*) FROM dms.document WHERE \"receiptType\"='RECEIVED_UNAPPLIED'")
            )
            == 1
        )
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM dms.upfront_confirmation "
                    "WHERE state='RECEIVED_SEPARATELY'"
                )
            )
            == 1
        )
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 1000


def test_retired_masters_and_terminated_agency_allow_historical_issue_successor(
    engine, actor, trading
):
    with Session(engine) as session:
        identifier = issue(session, actor, trading)
        cash = financial(session, actor, trading[0], 102)
        settlement(session, actor).post_receipt(cash, uuid4())
        commit(session)
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE dms.product SET status='INACTIVE' WHERE id=:id"), {"id": trading[1]}
        )
        connection.execute(
            text(
                "UPDATE dms.agency SET status='TERMINATED',"
                '"terminatedAt"=clock_timestamp(),"terminationReason"=\'Stopped\' WHERE id=:id'
            ),
            {"id": trading[0]},
        )
    with Session(engine) as session:
        result = use_case(session, actor).correct(
            identifier, replacement(trading[1], "1"), token(engine, actor, identifier), uuid4()
        )
    assert result.body["revisionNo"] == 2 and result.body["agencyBalance"]["currentDebt"] == "0"


def test_issue_cancel_without_money_and_mid_replay_failure_are_atomic(engine, actor, trading):
    with Session(engine) as session:
        identifier = issue(session, actor, trading, quantity=3)
        commit(session)
    condition, before = token(engine, actor, identifier), snapshot(engine)
    with Session(engine) as session:
        service = use_case(session, actor)
        original = service.settlement.replay

        def fail_after(*args, **kwargs):
            original(*args, **kwargs)
            raise RuntimeError("Injected issue replay failure")

        with (
            patch.object(service.settlement, "replay", side_effect=fail_after),
            pytest.raises(RuntimeError),
        ):
            service.correct(identifier, replacement(trading[1], "2"), condition, uuid4())
    assert snapshot(engine) == before
    with Session(engine) as session:
        result = use_case(session, actor).cancel(
            identifier, Reason(reason="Never delivered"), condition, uuid4()
        )
    assert result.body["agencyBalance"]["currentDebt"] == "0"
    assert result.body["inventoryChanges"][0]["currentStock"] == "1000"


@pytest.mark.parametrize("posted", [False, True])
def test_upfront_cash_grant_is_rechecked_after_separation(engine, actor, trading, posted):
    identifier = ready_with_money(engine, actor, trading, posted=posted)
    condition, before = token(engine, actor, identifier), snapshot(engine)
    allowed = {"documents.cancel", "cash.receipt.post"}

    def authorize(required):
        if not set(required) <= allowed:
            raise AuthError(403, "FORBIDDEN", "Cash permission revoked")

    with Session(engine) as session:
        service = use_case(session, actor, authorize)
        replay = service.settlement.replay

        def revoke_after_replay(*args, **kwargs):
            result = replay(*args, **kwargs)
            allowed.remove("cash.receipt.post")
            return result

        with (
            patch.object(service.settlement, "replay", side_effect=revoke_after_replay),
            pytest.raises(AuthError, match="FORBIDDEN"),
        ):
            service.cancel(identifier, Reason(reason="No delivery"), condition, uuid4())
    assert snapshot(engine) == before


def test_removed_retired_issue_product_reuses_latest_posted_snapshot(engine, actor, trading):
    from tests.integration.catalogues.helpers import product

    with Session(engine) as session:
        install_builders(session, actor)
        unit = session.scalar(
            text('SELECT "unitId" FROM dms.product WHERE id=:id'), {"id": trading[1]}
        )
        other = product(session, unit)
        opening = session.scalar(
            text("""SELECT pg_temp.stock_draft('STOCK_RECEIPT',NULL,DATE '2026-01-01',
            jsonb_build_array(jsonb_build_object('product',CAST(:id AS bigint),
            'quantity',1000,'price',100)),gen_random_uuid())"""),
            {"id": other},
        )
        session.execute(text("SELECT pg_temp.post_stock(:id)"), {"id": opening})
        commit(session)
        identifier = issue(session, actor, trading, quantity=3)
        commit(session)
        original = use_case(session, actor).core.repo.lines(
            use_case(session, actor).core.repo.document(identifier)["currentRevisionId"]
        )[0]
        use_case(session, actor).correct(
            identifier, replacement(other), token(engine, actor, identifier), uuid4()
        )
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE dms.product SET status='INACTIVE',name='Renamed' WHERE id=:id"),
            {"id": trading[1]},
        )
    with Session(engine) as session:
        service = use_case(session, actor)
        result = service.correct(
            identifier, replacement(trading[1]), token(engine, actor, identifier), uuid4()
        )
        line = service.core.repo.lines(service.core.repo.document(identifier)["currentRevisionId"])[
            0
        ]
        assert result.body["revisionNo"] == 3
        assert line["productName"] == original["productName"]
        assert line["basePurchasePrice"] == original["basePurchasePrice"]


def test_issue_duplicate_total_fraction_and_effective_returns_reject_atomically(
    engine, actor, trading
):
    from tests.integration.document_corrections.test_return_credit import post_return, returns

    with Session(engine) as session:
        identifier = issue(session, actor, trading, quantity=3)
        commit(session)
    line = {"productId": str(trading[1]), "quantity": "2"}
    before = snapshot(engine)
    for body, code in (
        (replacement(trading[1], lines=[line, line]), "DUPLICATE_PRODUCT"),
        (replacement(trading[1], "1.5"), "INVALID_QUANTITY"),
        (replacement(trading[1], sellingPriceRate="0.0001"), "SELLING_PRICE_UNUSABLE"),
    ):
        with Session(engine) as session, pytest.raises(ApiError) as error:
            use_case(session, actor).correct(
                identifier, body, token(engine, actor, identifier), uuid4()
            )
        assert error.value.code == code
        assert snapshot(engine) == before
    with Session(engine) as session:
        owner = returns(session, actor)
        source = owner.core.repo.lines(owner.core.repo.document(identifier)["currentRevisionId"])[0]
        post_return(owner, identifier, source["id"], "1", "2026-01-03")
    before = snapshot(engine)
    with Session(engine) as session, pytest.raises(ApiError, match="RETURN_SOURCE_CONFLICT"):
        use_case(session, actor).cancel(
            identifier, Reason(reason="Wrong delivery"), token(engine, actor, identifier), uuid4()
        )
    assert snapshot(engine) == before
    with Session(engine) as session, pytest.raises(ApiError, match="RETURN_SOURCE_CONFLICT"):
        use_case(session, actor).correct(
            identifier,
            replacement(trading[1], businessDate="2026-01-04"),
            token(engine, actor, identifier),
            uuid4(),
        )
    assert snapshot(engine) == before
