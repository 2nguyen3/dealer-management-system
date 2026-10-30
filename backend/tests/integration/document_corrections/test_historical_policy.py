from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.exceptions import ApiError
from app.modules.document_core.repository import DocumentRepository
from app.modules.stock_receipts.schemas import StockReceiptCorrection
from tests.integration.document_corrections.helpers import apply, condition, replacement, snapshot
from tests.integration.documents.test_receipts import post_receipt, receipt
from tests.support.database import migrate

pytestmark = pytest.mark.integration


def test_0007_reproduces_inactive_historical_receipt_successor_block(
    client, engine, actor, product
):
    migrate(engine.url, "0007", downgrade=True)
    created = receipt(client, product)
    assert post_receipt(client, created).status_code == 200
    with Session(engine) as session:
        session.execute(
            text("UPDATE dms.product SET status='INACTIVE' WHERE id=:id"),
            {"id": int(product["id"])},
        )
        session.commit()
        repo = DocumentRepository(session)
        identifier = int(created.json()["id"])
        old = repo.document(identifier)
        line = repo.lines(old["currentRevisionId"])[0]
        successor = repo.new_revision(identifier, date(2026, 10, 1), "Quantity error", actor)
        repo.put_line(
            successor,
            {
                key: value
                for key, value in line.items()
                if key not in ("id", "revisionId", "lineNo", "lineAmount", "createdAt", "updatedAt")
            },
        )
        repo.set_total(successor, line["lineAmount"])
        with pytest.raises(DBAPIError) as error:
            session.execute(
                text("""
                UPDATE dms.document_revision SET state='POSTED',"postedBy"=:actor,
                  "postedAt"=clock_timestamp() WHERE id=:id
                """),
                {"actor": actor, "id": successor},
            )
        assert error.value.orig.sqlstate == "23514"
        assert "inactive products/units" in str(error.value.orig)
        session.rollback()
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM dms.document_revision")) == 1
        assert connection.scalar(text('SELECT "currentStock" FROM dms.inventory_balance')) == 1


def test_historical_receipt_correction_reuses_inactive_snapshots_but_not_new_inactive_goods(
    client, engine, actor, product
):
    created = receipt(client, product, quantity="2")
    assert post_receipt(client, created).status_code == 200
    path, identifier = created.headers["Location"], int(created.json()["id"])
    old = client.get(path).json()["currentRevision"]["lines"][0]
    other = client.post(
        "/api/v1/products", json={"name": "Other", "unitId": product["unitId"]}
    ).json()
    unposted = receipt(client, product)
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE dms.product SET status='INACTIVE',name='Retired name' WHERE id=ANY(:ids)"),
            {"ids": [int(product["id"]), int(other["id"])]},
        )
        connection.execute(
            text("UPDATE dms.unit SET status='INACTIVE',name='Retired unit' WHERE id=:id"),
            {"id": product["unitId"]},
        )
    result = apply(engine, actor, identifier, replacement(product["id"]), condition(client, path))
    assert result.body["inventoryChanges"][0]["currentStock"] == "3"
    current = client.get(path).json()["currentRevision"]["lines"][0]
    assert current["productName"] == old["productName"]
    assert current["unitName"] == old["unitName"] and current["unitId"] == old["unitId"]
    assert post_receipt(client, unposted).status_code == 409
    before = snapshot(engine)
    with pytest.raises(ApiError) as error:
        apply(engine, actor, identifier, replacement(other["id"]), condition(client, path))
    assert error.value.code == "INACTIVE_MASTER" and snapshot(engine) == before
    # SQL itself also refuses a newly introduced inactive product in a successor.
    with Session(engine) as session:
        repo = DocumentRepository(session)
        revision = repo.new_revision(identifier, date(2026, 10, 1), "Wrong product", actor)
        repo.put_line(
            revision,
            {
                "productId": int(other["id"]),
                "quantity": 1,
                "unitPrice": 100,
                "unitId": product["unitId"],
                "productName": "Other",
                "unitName": "Original unit",
            },
        )
        repo.set_total(revision, 100)
        with pytest.raises(DBAPIError) as error:
            session.execute(
                text("""UPDATE dms.document_revision SET state='POSTED',"postedBy"=:actor,
                  "postedAt"=clock_timestamp() WHERE id=:id"""),
                {"actor": actor, "id": revision},
            )
        assert error.value.orig.sqlstate == "23514"
        session.rollback()
    assert snapshot(engine) == before


def test_populated_0007_upgrade_and_downgrade_preserve_history(client, engine, actor, product):
    migrate(engine.url, "0007", downgrade=True)
    incoming = receipt(client, product, quantity="2")
    assert post_receipt(client, incoming).status_code == 200
    before = snapshot(engine)
    migrate(engine.url, "head")
    assert snapshot(engine) == before
    identifier, path = int(incoming.json()["id"]), incoming.headers["Location"]
    result = apply(engine, actor, identifier, replacement(product["id"]), condition(client, path))
    assert result.status == 201
    successor = snapshot(engine)
    migrate(engine.url, "0007", downgrade=True)
    assert snapshot(engine) == successor
    migrate(engine.url, "head")
    assert snapshot(engine) == successor


def test_removed_receipt_product_reuses_latest_posted_snapshot_after_retirement(
    client, engine, actor, product
):
    other = client.post(
        "/api/v1/products", json={"name": "Retained product", "unitId": product["unitId"]}
    ).json()
    incoming = client.post(
        "/api/v1/stock-receipts",
        json={
            "businessDate": "2026-10-01",
            "lines": [
                {"productId": item["id"], "quantity": "2", "unitPrice": "100"}
                for item in (product, other)
            ],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert incoming.status_code == 201, incoming.text
    assert post_receipt(client, incoming).status_code == 200
    identifier, path = int(incoming.json()["id"]), incoming.headers["Location"]
    original = client.get(path).json()["currentRevision"]["lines"][0]
    apply(engine, actor, identifier, replacement(other["id"]), condition(client, path))
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE dms.product SET name='Renamed product' WHERE id=:id"),
            {"id": int(product["id"])},
        )
        connection.execute(
            text("UPDATE dms.unit SET name='Renamed unit' WHERE id=:id"),
            {"id": int(product["unitId"])},
        )
    body = StockReceiptCorrection(
        businessDate="2026-10-01",
        reason="Restore recorded goods",
        lines=[
            {"productId": item["id"], "quantity": "3", "unitPrice": "300"}
            for item in (product, other)
        ],
    )
    for retired in (False, True):
        if retired:
            apply(engine, actor, identifier, replacement(other["id"]), condition(client, path))
            with engine.begin() as connection:
                connection.execute(
                    text("UPDATE dms.product SET status='INACTIVE' WHERE id=:id"),
                    {"id": int(product["id"])},
                )
                connection.execute(
                    text("UPDATE dms.unit SET status='INACTIVE' WHERE id=:id"),
                    {"id": int(product["unitId"])},
                )
        before = snapshot(engine)
        restored = apply(engine, actor, identifier, body, condition(client, path))
        assert restored.status == 201
        current = client.get(path).json()["currentRevision"]["lines"][0]
        for name in ("productId", "unitId", "productName", "unitName"):
            assert current[name] == original[name]
        after = snapshot(engine)
        for table in ("document_revision", "document_line"):
            assert after[table][: len(before[table])] == before[table]
        assert {row["currentStock"] for row in after["inventory_balance"]} == {3}
