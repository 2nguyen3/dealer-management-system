from unittest.mock import Mock
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.preconditions import Preconditions
from app.core.exceptions import ApiError, AuthError
from app.modules.auth.service import AuthService
from app.modules.stock_receipts.schemas import Reason
from tests.integration.document_corrections.helpers import (
    apply,
    cancel,
    condition,
    replacement,
    service,
    snapshot,
)
from tests.integration.documents.test_receipts import post_receipt, receipt
from tests.integration.stock_counts.test_counts import action as count_action
from tests.integration.stock_counts.test_counts import create as count

pytestmark = pytest.mark.integration


def test_duplicate_total_fraction_and_stock_overflow_are_atomic(client, engine, actor, product):
    incoming = receipt(client, product, quantity="600000000000000", price="1")
    assert post_receipt(client, incoming).status_code == 200
    later = receipt(client, product, quantity="300000000000000", price="1")
    assert post_receipt(client, later).status_code == 200
    identifier, path = int(incoming.json()["id"]), incoming.headers["Location"]
    token = condition(client, path)
    line = {"productId": product["id"], "quantity": "1", "unitPrice": "100"}
    before = snapshot(engine)
    for body, code in (
        (replacement(product["id"], lines=[line, line]), "DUPLICATE_PRODUCT"),
        (
            replacement(product["id"], lines=[{**line, "quantity": "0.001", "unitPrice": "1"}]),
            "INVALID_TOTAL",
        ),
        (
            replacement(
                product["id"],
                lines=[
                    {**line, "quantity": "999999999999999.999", "unitPrice": "999999999999999999"}
                ],
            ),
            "TOTAL_OVERFLOW",
        ),
        (
            replacement(
                product["id"], lines=[{**line, "quantity": "700000000000000", "unitPrice": "1"}]
            ),
            "STOCK_OVERFLOW",
        ),
    ):
        with pytest.raises(ApiError) as error:
            apply(engine, actor, identifier, body, token)
        assert error.value.code == code
        assert snapshot(engine) == before
    unit = client.post("/api/v1/units", json={"code": "PCS", "name": "Piece"}).json()["id"]
    integer = client.post("/api/v1/products", json={"name": "Piece", "unitId": unit}).json()
    created = receipt(client, integer)
    assert post_receipt(client, created).status_code == 200
    before = snapshot(engine)
    with pytest.raises(ApiError) as error:
        apply(
            engine,
            actor,
            int(created.json()["id"]),
            replacement(integer["id"], quantity="1.5"),
            condition(client, created.headers["Location"]),
        )
    assert error.value.code == "INVALID_QUANTITY" and snapshot(engine) == before


def test_confirmed_count_adjustment_rejects_both_actions_with_no_effect(
    client, engine, actor, product
):
    incoming = receipt(client, product, quantity="10", business_date="2026-01-01")
    assert post_receipt(client, incoming).status_code == 200
    counted = count(client, product["id"], "9")
    confirmed = count_action(client, counted, "confirm")
    assert confirmed.status_code == 200, confirmed.text
    identifier = int(confirmed.json()["adjustmentDocumentId"])
    path = f"/api/v1/stock-adjustments/{identifier}"
    token, before = condition(client, path), snapshot(engine)
    for action in (
        lambda: apply(
            engine,
            actor,
            identifier,
            replacement(product["id"], kind="STOCK_ADJUSTMENT"),
            token,
            kind="STOCK_ADJUSTMENT",
        ),
        lambda: cancel(engine, actor, identifier, token, kind="STOCK_ADJUSTMENT"),
    ):
        with pytest.raises(ApiError) as error:
            action()
        assert error.value.code == "COUNT_LINKED_ADJUSTMENT" and snapshot(engine) == before


def test_live_grants_allof_and_cancel_only_replay_without_read_permission(
    client, engine, actor, product
):
    incoming = receipt(client, product, quantity="10")
    assert post_receipt(client, incoming).status_code == 200
    identifier, path = int(incoming.json()["id"]), incoming.headers["Location"]
    token, body = condition(client, path), replacement(product["id"])
    raw = client.headers["Authorization"].removeprefix("Bearer ")

    def grants(allowed):
        with engine.begin() as connection:
            connection.execute(
                text("""
                UPDATE dms.group_permission SET "isAllowed"=("functionId" IN (
                  SELECT id FROM dms.app_function WHERE code=ANY(:allowed))) WHERE "groupId"=1
                """),
                {"allowed": allowed},
            )

    def authorized(session):
        auth = AuthService(session, client.app.state.settings, Mock())
        principal = auth.authenticate(raw)

        def authorize(required):
            if not set(required) <= set(auth.get_current_user(principal).allowedFunctions):
                raise AuthError(403, "FORBIDDEN", "Denied")

        return service(session, actor, authorize=authorize)

    for allowed in (["documents.correct"], ["stock.receipt.post"], []):
        grants(allowed)
        before = snapshot(engine)
        with Session(engine) as session, pytest.raises(AuthError):
            authorized(session).correct(identifier, body, token, uuid4())
        assert snapshot(engine) == before
    grants(["documents.correct", "stock.receipt.post"])
    key = uuid4()
    with Session(engine) as session:
        result = authorized(session).correct(identifier, body, token, key)
    grants(["documents.correct"])
    with Session(engine) as session, pytest.raises(AuthError):
        authorized(session).correct(identifier, body, token, key)
    grants(["documents.cancel"])
    key, latest = uuid4(), Preconditions(result.headers["ETag"])
    with Session(engine) as session:
        canceled = authorized(session).cancel_document(
            identifier, Reason(reason="Wrong entry"), latest, key
        )
    with Session(engine) as session:
        repeated = authorized(session).cancel_document(
            identifier, Reason(reason="Wrong entry"), latest, key
        )
    assert repeated == canceled and canceled.body["status"] == "CANCELLED"
    grants([])
    with Session(engine) as session, pytest.raises(AuthError):
        authorized(session).cancel_document(identifier, Reason(reason="Wrong entry"), latest, key)
