from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError
from tests.integration.document_corrections.helpers import (
    apply,
    cancel,
    condition,
    replacement,
    service,
    snapshot,
)
from tests.integration.documents.test_receipts import post_receipt, receipt
from tests.integration.stock_adjustments.test_adjustments import create as adjustment
from tests.integration.stock_adjustments.test_adjustments import post as post_adjustment
from tests.support.contract import assert_schema

pytestmark = pytest.mark.integration


def test_receipt_successors_removed_goods_cancel_and_original_period_oracle(
    client, engine, actor, product
):
    first = receipt(client, product, quantity="2")
    assert post_receipt(client, first).status_code == 200
    later = receipt(client, product, quantity="5", price="200", business_date="2026-11-01")
    assert post_receipt(client, later).status_code == 200
    identifier, path = int(first.json()["id"]), first.headers["Location"]
    before = snapshot(engine)
    result = apply(
        engine,
        actor,
        identifier,
        replacement(product["id"], day="2026-12-01"),
        condition(client, path),
    )
    assert result.status == 201 and result.body["revisionNo"] == 2
    assert result.headers["Location"] == f"/api/v1/documents/{identifier}/revisions/2"
    assert_schema(result.body, "DocumentMutationResult")
    assert result.body["inventoryChanges"][0]["currentStock"] == "8"
    assert result.body["inventoryChanges"][0]["currentPurchasePrice"] == "300"
    after = snapshot(engine)
    assert after["document_revision"][:2] == before["document_revision"]
    assert after["document_line"][:2] == before["document_line"]
    assert after["document"][0]["businessOrder"] == before["document"][0]["businessOrder"]
    assert after["document"][0]["code"] == before["document"][0]["code"]
    with engine.connect() as connection:
        # Independent period oracle: the original October receipt no longer contributes.
        assert connection.execute(
            text("""
            SELECT "businessDate",sum(quantity) FROM dms.inventory_entry
            GROUP BY "businessDate" ORDER BY "businessDate"
            """)
        ).all() == [
            (before["document_revision"][0]["businessDate"], 0),
            (before["document_revision"][1]["businessDate"], 5),
            (after["document_revision"][2]["businessDate"], 3),
        ]
    other = client.post(
        "/api/v1/products", json={"name": "Other", "unitId": product["unitId"]}
    ).json()
    replaced = apply(engine, actor, identifier, replacement(other["id"]), condition(client, path))
    assert replaced.body["revisionNo"] == 3
    assert [(i["productId"], i["currentStock"]) for i in replaced.body["inventoryChanges"]] == [
        (product["id"], "5"),
        (other["id"], "3"),
    ]
    canceled = cancel(engine, actor, identifier, Preconditions(replaced.headers["ETag"]))
    assert canceled.body["status"] == "CANCELLED" and canceled.body["revisionNo"] == 3
    assert canceled.body["inventoryChanges"][0]["currentStock"] == "0"
    assert canceled.body["inventoryChanges"][0]["currentPurchasePrice"] == "0"
    assert client.get(path).json()["cancelReason"] == "Recorded in error"
    assert client.get("/api/v1/products/" + product["id"]).json()["currentPurchasePrice"] == "200"


def test_adjustment_correct_cancel_and_draft_branches_are_stock_only(
    client, engine, actor, product
):
    incoming = receipt(client, product, quantity="10")
    assert post_receipt(client, incoming).status_code == 200
    created = adjustment(client, product["id"], "-3", "2026-10-02")
    assert post_adjustment(client, created).status_code == 200
    identifier, path = int(created.json()["id"]), created.headers["Location"]
    body = replacement(product["id"], kind="STOCK_ADJUSTMENT", quantity="-2", day="2026-10-03")
    result = apply(
        engine, actor, identifier, body, condition(client, path), kind="STOCK_ADJUSTMENT"
    )
    assert result.body["inventoryChanges"][0]["currentStock"] == "8"
    assert result.body["inventoryChanges"][0]["currentPurchasePrice"] == "100"
    assert result.body["totalAmount"] == "0"
    cancelled = cancel(
        engine, actor, identifier, Preconditions(result.headers["ETag"]), kind="STOCK_ADJUSTMENT"
    )
    assert cancelled.body["inventoryChanges"][0]["currentStock"] == "10"
    for kind, draft in (
        ("STOCK_RECEIPT", receipt(client, product)),
        ("STOCK_ADJUSTMENT", adjustment(client, product["id"], "1", "2026-10-02")),
    ):
        result = cancel(
            engine, actor, int(draft.json()["id"]), Preconditions(draft.headers["ETag"]), kind=kind
        )
        assert result.body["inventoryChanges"] == [] and result.body["status"] == "CANCELLED"
    persisted = snapshot(engine)
    assert not persisted["receivable_entry"] and not persisted["credit_entry"]
    assert len(persisted["inventory_entry"]) == 5


def test_negative_past_and_removed_goods_fail_atomically_even_with_positive_current_stock(
    client, engine, actor, product
):
    incoming = receipt(client, product, quantity="10")
    assert post_receipt(client, incoming).status_code == 200
    consumed = adjustment(client, product["id"], "-8", "2026-10-02")
    assert post_adjustment(client, consumed).status_code == 200
    replenished = receipt(client, product, quantity="10", business_date="2026-10-03")
    assert post_receipt(client, replenished).status_code == 200
    identifier, path = int(incoming.json()["id"]), incoming.headers["Location"]
    other = client.post(
        "/api/v1/products", json={"name": "Other", "unitId": product["unitId"]}
    ).json()
    token = condition(client, path)
    before = snapshot(engine)
    actions = (
        lambda: apply(
            engine, actor, identifier, replacement(product["id"], day="2026-10-04"), token
        ),
        lambda: apply(engine, actor, identifier, replacement(other["id"]), token),
        lambda: cancel(engine, actor, identifier, token),
    )
    for action in actions:
        with pytest.raises(ApiError) as error:
            action()
        assert error.value.code == "STOCK_CONFLICT"
        assert snapshot(engine) == before


def test_injected_failures_restore_all_revisions_ledgers_audit_and_command(
    client, engine, actor, product
):
    incoming = receipt(client, product, quantity="10")
    assert post_receipt(client, incoming).status_code == 200
    identifier, path = int(incoming.json()["id"]), incoming.headers["Location"]
    token, body = condition(client, path), replacement(product["id"])
    before = snapshot(engine)
    with Session(engine) as session:
        use_case = service(session, actor)
        for target, name in (
            (use_case.core.repo, "put_line"),
            (use_case.inventory, "reverse_revision"),
            (use_case.inventory, "append"),
            (use_case.owner, "result"),
        ):
            original = getattr(target, name)

            def fail_after(*args, _original=original, **kwargs):
                _original(*args, **kwargs)
                raise RuntimeError("Injected correction stage failure")

            with patch.object(target, name, side_effect=fail_after), pytest.raises(RuntimeError):
                use_case.correct(identifier, body, token, uuid4())
            assert snapshot(engine) == before


def test_same_key_retry_and_stale_state_payload_ownership_boundaries(
    client, engine, actor, product
):
    draft = receipt(client, product, quantity="10")
    identifier, path = int(draft.json()["id"]), draft.headers["Location"]
    body = replacement(product["id"])
    with pytest.raises(ApiError) as error:
        apply(engine, actor, identifier, body, condition(client, path))
    assert error.value.code == "STATE_CONFLICT"
    assert post_receipt(client, draft).status_code == 200
    token, key = condition(client, path), uuid4()
    first = apply(engine, actor, identifier, body, token, key=key)
    repeated = apply(engine, actor, identifier, body, token, key=key)
    assert first == repeated
    for action, code in (
        (lambda: apply(engine, actor, identifier, body, token), "PRECONDITION_FAILED"),
        (
            lambda: apply(
                engine, actor, identifier, replacement(product["id"], quantity="4"), token, key=key
            ),
            "IDEMPOTENCY_KEY_REUSED",
        ),
        (
            lambda: apply(
                engine,
                actor,
                identifier,
                replacement(product["id"], kind="STOCK_ADJUSTMENT"),
                token,
                kind="STOCK_ADJUSTMENT",
            ),
            "NOT_FOUND",
        ),
        (lambda: apply(engine, actor, 999999, body, token), "NOT_FOUND"),
    ):
        before = snapshot(engine)
        with pytest.raises(ApiError) as error:
            action()
        assert error.value.code == code
        assert snapshot(engine) == before
    latest = Preconditions(first.headers["ETag"])
    canceled = cancel(engine, actor, identifier, latest)
    with pytest.raises(ApiError) as error:
        cancel(engine, actor, identifier, Preconditions(canceled.headers["ETag"]))
    assert error.value.code == "STATE_CONFLICT"
