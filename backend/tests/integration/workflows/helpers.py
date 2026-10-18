from uuid import uuid4

from sqlalchemy import text


def issue(client, trading, *, quantity="3", immediate="0", day="2026-01-02", submit=True):
    response = client.post(
        "/api/v1/stock-issues",
        json={
            "agencyId": trading["agency"],
            "businessDate": day,
            "immediatePayment": immediate,
            "lines": [{"productId": trading["product"], "quantity": quantity}],
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert response.status_code == 201, response.text
    if submit:
        response = client.post(
            response.headers["Location"] + "/submit",
            headers={"If-Match": response.headers["ETag"], "Idempotency-Key": str(uuid4())},
        )
        assert response.status_code == 200, response.text
    return response


def post_issue(client, created):
    path = "/api/v1/stock-issues/" + created.json()["id"]
    current = client.get(path)
    return client.post(
        path + "/post",
        headers={"If-Match": current.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )


def verify(client, ready, *, amount="200", received="2026-01-01T18:00:00Z"):
    response = client.post(
        "/api/v1/upfront-confirmations",
        json={
            "issueRevisionId": ready.json()["revisionId"],
            "amount": amount,
            "method": "CASH",
            "receivedAt": received,
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert response.status_code == 201, response.text
    return response


def receipt(client, trading, *, amount="100", day="2026-01-03", method="CASH"):
    response = client.post(
        "/api/v1/payment-receipts",
        json={
            "agencyId": trading["agency"],
            "businessDate": day,
            "amount": amount,
            "paymentMethod": method,
        },
        headers={"Idempotency-Key": str(uuid4())},
    )
    assert response.status_code == 201, response.text
    return response


def post_receipt(client, created):
    return client.post(
        created.headers["Location"] + "/post",
        headers={"If-Match": created.headers["ETag"], "Idempotency-Key": str(uuid4())},
    )


def state(engine):
    with engine.connect() as connection:
        tables = (
            "document",
            "document_revision",
            "document_line",
            "posting_batch",
            "inventory_entry",
            "receivable_entry",
            "credit_entry",
            "credit_lot",
            "upfront_confirmation",
            "audit_log",
            "api_idempotency",
        )
        pairs = ",".join(
            f"'{name}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) "
            f"FROM dms.{name} t)"
            for name in tables
        )
        return connection.scalar(text("SELECT jsonb_build_object(" + pairs + ")"))
