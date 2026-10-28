from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from app.modules.stock_receipts.schemas import Reason
from tests.integration.document_corrections.helpers import snapshot
from tests.integration.document_corrections.manual_helpers import (
    manual_body,
    manual_condition,
    manual_service,
    timeline,
)
from tests.integration.settlement_core.helpers import commit, financial, issue
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_manual_correction_replays_several_later_receipts_and_preserves_frozen_snapshots(
    engine, actor, trading
):
    invoices, receipts = timeline(engine, actor, trading)
    identifier = receipts[0]
    before = snapshot(engine)
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE dms.agency SET name='Renamed agency' WHERE id=:id"), {"id": trading[0]}
        )
    key, body = uuid4(), manual_body()
    token = manual_condition(engine, actor, identifier)
    with Session(engine) as session:
        result = manual_service(session, actor).correct(identifier, body, token, key)
    assert result.status == 201 and result.body["revisionNo"] == 2
    assert result.headers["Location"] == f"/api/v1/documents/{identifier}/revisions/2"
    assert result.body["agencyBalance"]["currentDebt"] == "112"
    assert result.body["agencyBalance"]["currentCredit"] == "0"
    assert result.body["inventoryChanges"] == []
    assert_schema(result.body, "DocumentMutationResult")
    after = snapshot(engine)
    assert after["document_revision"][:-1] == before["document_revision"]
    assert after["document_line"] == before["document_line"]
    assert after["inventory_entry"] == before["inventory_entry"]
    assert after["document_revision"][-1]["agencyName"] == "Agency"
    for previous, current in zip(before["document"], after["document"], strict=True):
        assert (
            previous["id"],
            previous["code"],
            previous["businessOrder"],
            previous["agencyId"],
        ) == (current["id"], current["code"], current["businessOrder"], current["agencyId"])
    with Session(engine) as session:
        use_case = manual_service(session, actor)
        repo = use_case.settlement.repo
        actual = [
            [
                (row["issueDocumentId"], row["amount"])
                for row in repo.effective(repo.source(r)["revisionId"], "receivable")
            ]
            for r in receipts
        ]
        assert actual == [
            [(invoices[0], -100)],
            [(invoices[0], -104), (invoices[1], -96)],
            [(invoices[1], -108), (invoices[2], -92)],
        ]
        repeated = use_case.correct(identifier, body, token, key)
        assert repeated == result
        moved = use_case.correct(
            identifier,
            manual_body(day="2026-01-08"),
            Preconditions(result.headers["ETag"]),
            uuid4(),
        )
        assert moved.body["revisionNo"] == 3 and moved.body["agencyBalance"]["currentDebt"] == "112"
        canceled = use_case.cancel(
            identifier, Reason(reason="False record"), Preconditions(moved.headers["ETag"]), uuid4()
        )
        assert canceled.body["status"] == "CANCELLED"
        assert canceled.body["agencyBalance"]["currentDebt"] == "212"


def test_manual_conflicts_and_injected_replay_failure_restore_all_state(engine, actor, trading):
    _, receipts = timeline(engine, actor, trading)
    identifier, body = receipts[0], manual_body()
    token = manual_condition(engine, actor, identifier)
    before = snapshot(engine)
    for replacement, condition, expected in (
        (manual_body("500"), token, "PAYMENT_EXCEEDS_DEBT"),
        (manual_body(day="2026-01-01"), token, "PAYMENT_EXCEEDS_DEBT"),
        (manual_body(day="2025-12-31"), token, "AGENCY_CONFLICT"),
        (body, Preconditions('"stale"'), "PRECONDITION_FAILED"),
    ):
        with Session(engine) as session, pytest.raises(ApiError) as error:
            manual_service(session, actor).correct(identifier, replacement, condition, uuid4())
        assert error.value.code == expected and snapshot(engine) == before
    with Session(engine) as session:
        use_case = manual_service(session, actor)
        for target, name in (
            (use_case.settlement.repo, "reverse"),
            (use_case.settlement, "replay"),
            (use_case.owner, "result"),
        ):
            original = getattr(target, name)

            def fail_after(*args, _original=original, **kwargs):
                _original(*args, **kwargs)
                raise RuntimeError("Injected manual correction stage failure")

            with patch.object(target, name, side_effect=fail_after), pytest.raises(RuntimeError):
                use_case.correct(identifier, body, token, uuid4())
            assert snapshot(engine) == before
    with engine.begin() as connection:
        connection.execute(text('UPDATE dms.agency_type SET "maxDebt"=62 WHERE id=1'))
    before = snapshot(engine)
    with Session(engine) as session, pytest.raises(ApiError) as error:
        manual_service(session, actor).cancel(
            identifier, Reason(reason="False record"), token, uuid4()
        )
    assert error.value.code == "LIMIT_CONFLICT" and snapshot(engine) == before


def test_manual_draft_cancel_wrong_kind_and_special_cash_guards(engine, actor, trading):
    with Session(engine) as session:
        invoice = issue(session, actor, trading, quantity=3)
        commit(session)
        draft = financial(session, actor, trading[0], 100)
        specials = [
            financial(session, actor, trading[0], 100, receipt=kind, method=method, origin=origin)
            for kind, method, origin in (
                ("AUTO_FROM_ISSUE", "CASH", invoice),
                ("RECEIVED_UNAPPLIED", "CASH", None),
                ("DEBT_COLLECTION", "ONLINE", None),
            )
        ]
        commit(session)
    before = snapshot(engine)
    with Session(engine) as session, pytest.raises(ApiError) as error:
        manual_service(session, actor).correct(
            draft, manual_body(), manual_condition(engine, actor, draft), uuid4()
        )
    assert error.value.code == "STATE_CONFLICT" and snapshot(engine) == before
    for identifier in specials:
        token = manual_condition(engine, actor, identifier)
        for correcting in (True, False):
            with Session(engine) as session, pytest.raises(ApiError) as error:
                use_case = manual_service(session, actor)
                if correcting:
                    use_case.correct(identifier, manual_body(), token, uuid4())
                else:
                    use_case.cancel(identifier, Reason(reason="Do not erase money"), token, uuid4())
            assert error.value.code == "RECEIPT_CONFLICT" and snapshot(engine) == before
    with Session(engine) as session, pytest.raises(ApiError) as error:
        manual_service(session, actor).correct(
            invoice, manual_body(), Preconditions('"irrelevant"'), uuid4()
        )
    assert error.value.code == "NOT_FOUND"
    with Session(engine) as session:
        canceled = manual_service(session, actor).cancel(
            draft, Reason(reason="Not received"), manual_condition(engine, actor, draft), uuid4()
        )
    assert canceled.body["status"] == "CANCELLED" and len(snapshot(engine)["receivable_entry"]) == 1
    with Session(engine) as session, pytest.raises(ApiError) as error:
        manual_service(session, actor).cancel(
            draft, Reason(reason="Again"), Preconditions(canceled.headers["ETag"]), uuid4()
        )
    assert error.value.code == "STATE_CONFLICT"
