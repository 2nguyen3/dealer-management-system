"""DocumentService on real PostgreSQL: post/cancel/correct × 3 kinds and QĐ1–QĐ8.

Each rule has a passing case, a blocked case and a boundary case (handoff 5.4).
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.exceptions import ApiError
from app.modules.document_core.schemas import (
    PaymentReceiptCorrection,
    PaymentReceiptInput,
    StockIssueCorrection,
    StockIssueInput,
    StockReceiptCorrection,
    StockReceiptInput,
)
from tests.integration.documents.conftest import balances, match, previous_month_day, today

pytestmark = pytest.mark.integration


def receipt_body(*lines, business_date=None, note=None):
    return StockReceiptInput.model_validate(
        {
            "businessDate": business_date,
            "note": note,
            "lines": [
                {"productId": str(product), "quantity": str(quantity), "unitPrice": str(price)}
                for product, quantity, price in lines
            ],
        }
    )


def issue_body(agency, *lines, business_date=None):
    return StockIssueInput.model_validate(
        {
            "agencyId": str(agency),
            "businessDate": business_date,
            "lines": [
                {"productId": str(product), "quantity": str(quantity)}
                for product, quantity in lines
            ],
        }
    )


def payment_body(agency, amount, receipt_type="CASH", business_date=None):
    return PaymentReceiptInput.model_validate(
        {
            "agencyId": str(agency),
            "amount": str(amount),
            "receiptType": receipt_type,
            "businessDate": business_date,
        }
    )


def post_new(service, body):
    draft = service.create(body)
    return service.post(int(draft.id), match(service, draft))


def code(error: pytest.ExceptionInfo) -> str:
    return error.value.code


@pytest.fixture
def stocked(documents, world):
    """100 cartons of noodles at 100,000đ and 50 kg rice at 20,000đ."""
    receipts = documents("STOCK_RECEIPT")
    return post_new(receipts, receipt_body((world.noodles, 100, 100000), (world.rice, 50, 20000)))


# ------------------------------------------------------------- receipts ----


def test_receipt_draft_does_not_touch_stock(documents, world, engine):
    service = documents("STOCK_RECEIPT")
    draft = service.create(receipt_body((world.noodles, 10, 95000), note="Giao đợt 2"))
    assert draft.status == "DRAFT"
    assert draft.code.startswith("PN-")
    assert draft.totalAmount == Decimal(950000)
    assert draft.lines[0].productName == "Mì Hảo Hảo thùng 30 gói"
    assert draft.note == "Giao đợt 2"
    stock, _, prices = balances(engine, world)
    assert stock[world.noodles] == 0 and prices[world.noodles] is None


def test_receipt_post_updates_stock_and_last_price(documents, world, engine):
    posted = post_new(
        documents("STOCK_RECEIPT"),
        receipt_body((world.noodles, 10, 95000), (world.rice, Decimal("2.5"), 20000)),
    )
    assert posted.status == "POSTED"
    assert posted.postedBy == str(world.manager) and posted.postedAt is not None
    assert posted.totalAmount == Decimal(1000000)
    stock, _, prices = balances(engine, world)
    assert stock[world.noodles] == 10 and stock[world.rice] == Decimal("2.5")
    assert prices[world.noodles] == 95000


def test_receipt_post_requires_lines(documents):
    service = documents("STOCK_RECEIPT")
    draft = service.create(receipt_body())
    with pytest.raises(ApiError) as error:
        service.post(int(draft.id), match(service, draft))
    assert code(error) == "EMPTY_DOCUMENT"


@pytest.mark.parametrize(
    ("lines", "expected"),
    [
        ("retired", "INACTIVE_MASTER"),
        ("fraction", "FRACTION_NOT_ALLOWED"),
        ("duplicate", "DUPLICATE_PRODUCT"),
        ("missing", "NOT_FOUND"),
    ],
)
def test_receipt_draft_line_validation(documents, world, lines, expected):
    body = {
        "retired": receipt_body((world.retired, 1, 1000)),
        "fraction": receipt_body((world.noodles, Decimal("1.5"), 1000)),
        "duplicate": receipt_body((world.noodles, 1, 1000), (world.noodles, 2, 1000)),
        "missing": receipt_body((999999, 1, 1000)),
    }[lines]
    with pytest.raises(ApiError) as error:
        documents("STOCK_RECEIPT").create(body)
    assert code(error) == expected


def test_business_date_cannot_be_in_the_future(documents, world, engine):
    tomorrow = today(engine) + timedelta(days=1)
    with pytest.raises(ApiError) as error:
        documents("STOCK_RECEIPT").create(
            receipt_body((world.noodles, 1, 1000), business_date=tomorrow)
        )
    assert code(error) == "VALIDATION_FAILED"
    # Boundary: today is accepted.
    assert documents("STOCK_RECEIPT").create(
        receipt_body((world.noodles, 1, 1000), business_date=today(engine))
    ).businessDate == today(engine)


def test_replace_and_delete_draft_with_if_match(documents, world):
    service = documents("STOCK_RECEIPT")
    draft = service.create(receipt_body((world.noodles, 1, 1000)))
    replaced = service.replace(
        int(draft.id), receipt_body((world.rice, Decimal("0.5"), 2000)), match(service, draft)
    )
    assert [line.productId for line in replaced.lines] == [str(world.rice)]
    assert replaced.totalAmount == Decimal(1000)
    with pytest.raises(ApiError) as error:
        service.replace(int(draft.id), receipt_body((world.noodles, 1, 1)), match(service, draft))
    assert code(error) == "PRECONDITION_FAILED"
    service.delete(int(draft.id), match(service, replaced))
    with pytest.raises(ApiError) as error:
        service.get(int(draft.id))
    assert code(error) == "NOT_FOUND"


def test_posted_document_cannot_be_edited_or_deleted(documents, stocked, world):
    service = documents("STOCK_RECEIPT")
    with pytest.raises(ApiError) as error:
        service.replace(
            int(stocked.id), receipt_body((world.noodles, 1, 1)), match(service, stocked)
        )
    assert code(error) == "STATE_CONFLICT"
    with pytest.raises(ApiError) as error:
        service.delete(int(stocked.id), match(service, stocked))
    assert code(error) == "STATE_CONFLICT"
    with pytest.raises(ApiError) as error:
        service.post(int(stocked.id), match(service, stocked))
    assert code(error) == "STATE_CONFLICT"


def test_cancel_receipt_reverses_stock_and_price(documents, world, engine, stocked):
    service = documents("STOCK_RECEIPT")
    later = post_new(service, receipt_body((world.noodles, 20, 110000)))
    assert balances(engine, world)[2][world.noodles] == 110000
    cancelled = service.cancel(int(later.id), "Nhập sai số lượng dòng 1", match(service, later))
    assert cancelled.status == "CANCELLED"
    assert cancelled.cancelReason == "Nhập sai số lượng dòng 1"
    assert cancelled.cancelledBy == str(world.manager)
    stock, _, prices = balances(engine, world)
    assert stock[world.noodles] == 100
    assert prices[world.noodles] == 100000  # back to the latest remaining receipt


def test_cancel_receipt_blocked_when_stock_would_go_negative(documents, world, engine, stocked):
    post_new(documents("STOCK_ISSUE"), issue_body(world.agency, (world.noodles, 30)))
    service = documents("STOCK_RECEIPT")
    with pytest.raises(ApiError) as error:
        service.cancel(int(stocked.id), "Nhập trùng", match(service, stocked))
    assert code(error) == "INSUFFICIENT_STOCK"
    assert service.get(int(stocked.id)).status == "POSTED"
    assert balances(engine, world)[0][world.noodles] == 70


def test_cancel_requires_reason(documents, stocked):
    service = documents("STOCK_RECEIPT")
    with pytest.raises(ApiError) as error:
        service.cancel(int(stocked.id), "   ", match(service, stocked))
    assert code(error) == "REASON_REQUIRED"


def test_correct_receipt_replaces_in_one_transaction(documents, world, engine, stocked):
    post_new(documents("STOCK_ISSUE"), issue_body(world.agency, (world.noodles, 80)))
    service = documents("STOCK_RECEIPT")
    body = StockReceiptCorrection.model_validate(
        {
            "reason": "Nhập sai số lượng dòng 1, lập lại phiếu",
            "lines": [
                {"productId": str(world.noodles), "quantity": "90", "unitPrice": "100000"},
                {"productId": str(world.rice), "quantity": "50", "unitPrice": "20000"},
            ],
        }
    )
    replacement = service.correct(int(stocked.id), body, match(service, stocked))
    assert replacement.status == "POSTED"
    assert replacement.replacesDocumentId == stocked.id
    assert replacement.replaces.code == stocked.code
    old = service.get(int(stocked.id))
    assert old.status == "CANCELLED" and old.replacedByDocumentId == replacement.id
    assert old.cancelReason == "Nhập sai số lượng dòng 1, lập lại phiếu"
    # 90 received − 80 issued; cancelling first would have gone below zero.
    assert balances(engine, world)[0][world.noodles] == 10


# --------------------------------------------------------------- issues ----


def test_issue_price_is_last_purchase_price_times_rate(documents, world, stocked):
    service = documents("STOCK_ISSUE")
    draft = service.create(issue_body(world.agency, (world.noodles, 3), (world.rice, "1.5")))
    assert [line.unitPrice for line in draft.lines] == [Decimal(102000), Decimal(20400)]
    posted = service.post(int(draft.id), match(service, draft))
    assert posted.sellingPriceRate == Decimal("1.02")
    assert posted.totalAmount == Decimal(3 * 102000 + 30600)
    assert posted.agencyDebt == posted.totalAmount
    assert posted.agencyMaxDebt == world.max_debt


def test_issue_price_is_fixed_when_posting(documents, world, stocked):
    service = documents("STOCK_ISSUE")
    draft = service.create(issue_body(world.agency, (world.noodles, 1)))
    post_new(documents("STOCK_RECEIPT"), receipt_body((world.noodles, 1, 110000)))
    posted = service.post(int(draft.id), match(service, service.get(int(draft.id))))
    assert posted.lines[0].unitPrice == Decimal(112200)


def test_unpriced_product_cannot_be_issued(documents, world, stocked):
    with pytest.raises(ApiError) as error:
        documents("STOCK_ISSUE").create(issue_body(world.agency, (world.unpriced, 1)))
    assert code(error) == "PRODUCT_NOT_PRICED"


def test_issue_quantity_limited_by_current_stock(documents, world, engine, stocked):
    service = documents("STOCK_ISSUE")
    too_many = service.create(issue_body(world.agency, (world.noodles, 101)))
    with pytest.raises(ApiError) as error:
        service.post(int(too_many.id), match(service, too_many))
    assert code(error) == "INSUFFICIENT_STOCK"
    assert error.value.details["productId"] == str(world.noodles)
    # Boundary: exactly the stock (using a second agency below its limit).
    exact = post_new(service, issue_body(world.second_agency, (world.rice, 50)))
    assert exact.status == "POSTED"
    assert balances(engine, world)[0][world.rice] == 0


def test_issue_debt_limit(documents, world, engine, stocked):
    service = documents("STOCK_ISSUE")
    # 98 cartons × 102,000 = 9,996,000 ≤ 10,000,000.
    post_new(service, issue_body(world.agency, (world.noodles, 98)))
    over = service.create(issue_body(world.agency, (world.rice, 1)))  # +20,400
    with pytest.raises(ApiError) as error:
        service.post(int(over.id), match(service, over))
    assert code(error) == "DEBT_LIMIT_EXCEEDED"
    assert balances(engine, world)[1][world.agency] == Decimal(9_996_000)


def test_issue_debt_limit_boundary_is_inclusive(documents, world, engine):
    # 2,000 × round(4,900 × 1.02) = 9,996,000; 3.922 kg × 1,020 rounds to 4,000.
    post_new(
        documents("STOCK_RECEIPT"),
        receipt_body((world.noodles, 2000, 4900), (world.rice, 10, 1000)),
    )
    with pytest.raises(ApiError):
        post_new(documents("STOCK_ISSUE"), issue_body(world.agency, (world.noodles, 2001)))
    posted = post_new(
        documents("STOCK_ISSUE"),
        issue_body(world.agency, (world.noodles, 2000), (world.rice, Decimal("3.922"))),
    )
    assert posted.agencyDebt == world.max_debt


def test_terminated_agency_and_inactive_product_rejected(documents, world, stocked, engine):
    with pytest.raises(ApiError) as error:
        documents("STOCK_ISSUE").create(issue_body(world.terminated, (world.noodles, 1)))
    assert code(error) == "AGENCY_TERMINATED"
    service = documents("STOCK_ISSUE")
    draft = service.create(issue_body(world.agency, (world.noodles, 1)))
    with engine.begin() as connection:
        connection.execute(
            text("UPDATE dms.product SET status='INACTIVE' WHERE id=:id"), {"id": world.noodles}
        )
    with pytest.raises(ApiError) as error:
        service.post(int(draft.id), match(service, service.get(int(draft.id))))
    assert code(error) == "INACTIVE_MASTER"


def test_cancel_issue_restores_stock_and_debt(documents, world, engine, stocked):
    service = documents("STOCK_ISSUE")
    issue = post_new(service, issue_body(world.agency, (world.noodles, 10)))
    service.cancel(int(issue.id), "Đại lý đổi ý, chưa lấy hàng", match(service, issue))
    stock, debt, _ = balances(engine, world)
    assert stock[world.noodles] == 100 and debt[world.agency] == 0


def test_correct_issue_applies_net_effect(documents, world, engine, stocked):
    service = documents("STOCK_ISSUE")
    issue = post_new(service, issue_body(world.agency, (world.noodles, 90)))  # 9,180,000
    body = StockIssueCorrection.model_validate(
        {
            "reason": "Giao thiếu 5 thùng",
            "lines": [{"productId": str(world.noodles), "quantity": "95"}],
        }
    )
    # 95 × 102,000 = 9,690,000 fits only because the old issue is cancelled first.
    replacement = service.correct(int(issue.id), body, match(service, issue))
    assert replacement.agencyId == str(world.agency)
    stock, debt, _ = balances(engine, world)
    assert stock[world.noodles] == 5 and debt[world.agency] == Decimal(9_690_000)


def test_failed_correction_keeps_original(documents, world, engine, stocked):
    service = documents("STOCK_ISSUE")
    issue = post_new(service, issue_body(world.agency, (world.noodles, 10)))
    body = StockIssueCorrection.model_validate(
        {"reason": "Thêm hàng", "lines": [{"productId": str(world.noodles), "quantity": "120"}]}
    )
    with pytest.raises(ApiError) as error:
        service.correct(int(issue.id), body, match(service, issue))
    assert code(error) == "INSUFFICIENT_STOCK"
    assert service.get(int(issue.id)).status == "POSTED"
    stock, debt, _ = balances(engine, world)
    assert stock[world.noodles] == 90 and debt[world.agency] == Decimal(1_020_000)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM dms.document")).scalar_one() == 2


# ------------------------------------------------------------- payments ----


@pytest.fixture
def indebted(documents, world, stocked):
    """Agency owes 1,020,000đ."""
    return post_new(documents("STOCK_ISSUE"), issue_body(world.agency, (world.noodles, 10)))


def test_payment_cannot_exceed_current_debt(documents, world, engine, indebted):
    service = documents("PAYMENT_RECEIPT", world.clerk)
    with pytest.raises(ApiError) as error:
        post_new(service, payment_body(world.agency, 1_020_001))
    assert code(error) == "PAYMENT_EXCEEDS_DEBT"
    partial = post_new(service, payment_body(world.agency, 20_000, "BANK_TRANSFER"))
    assert partial.agencyDebt == Decimal(1_000_000)
    assert partial.receiptType == "BANK_TRANSFER" and partial.lines == []
    exact = post_new(service, payment_body(world.agency, 1_000_000))
    assert exact.agencyDebt == 0
    assert balances(engine, world)[1][world.agency] == 0


def test_payment_rejected_without_debt(documents, world):
    with pytest.raises(ApiError) as error:
        post_new(documents("PAYMENT_RECEIPT"), payment_body(world.second_agency, 1))
    assert code(error) == "PAYMENT_EXCEEDS_DEBT"


def test_cancel_payment_may_exceed_limit(documents, world, engine, stocked):
    issues = documents("STOCK_ISSUE")
    post_new(issues, issue_body(world.agency, (world.noodles, 90)))  # 9,180,000
    payments = documents("PAYMENT_RECEIPT")
    payment = post_new(payments, payment_body(world.agency, 5_000_000))
    post_new(issues, issue_body(world.agency, (world.noodles, 10)))  # 5,200,000
    cancelled = payments.cancel(int(payment.id), "Khách báo chuyển nhầm", match(payments, payment))
    assert cancelled.agencyDebt == Decimal(10_200_000) > world.max_debt  # QĐ7


def test_correct_payment(documents, world, engine, indebted):
    service = documents("PAYMENT_RECEIPT")
    payment = post_new(service, payment_body(world.agency, 500_000))
    body = PaymentReceiptCorrection.model_validate(
        {"reason": "Ghi nhầm số tiền", "amount": "1020000", "receiptType": "BANK_TRANSFER"}
    )
    replacement = service.correct(int(payment.id), body, match(service, payment))
    assert replacement.totalAmount == Decimal(1_020_000)
    assert balances(engine, world)[1][world.agency] == 0
    too_much = PaymentReceiptCorrection.model_validate({"reason": "Sai", "amount": "1020001"})
    with pytest.raises(ApiError) as error:
        service.correct(int(replacement.id), too_much, match(service, replacement))
    assert code(error) == "PAYMENT_EXCEEDS_DEBT"


def test_online_receipt_may_make_debt_negative(documents, world, engine, indebted):
    service = documents("PAYMENT_RECEIPT")
    post_new(service, payment_body(world.agency, 1_020_000))
    receipt_id = service.record_online_receipt(
        world.agency, Decimal(200_000), note="VNPAY 14501234"
    )
    service.session.commit()
    online = service.get(receipt_id)
    assert online.receiptType == "ONLINE" and online.status == "POSTED"
    assert balances(engine, world)[1][world.agency] == Decimal(-200_000)
    with pytest.raises(ApiError) as error:
        service.cancel(receipt_id, "Không hợp lệ", match(service, online))
    assert code(error) == "STATE_CONFLICT"
    # The next issue is netted against the prepayment.
    issue = post_new(documents("STOCK_ISSUE"), issue_body(world.agency, (world.noodles, 1)))
    assert issue.agencyDebt == Decimal(-98_000)


def test_manual_payment_cannot_be_online(world):
    with pytest.raises(ValueError):
        payment_body(world.agency, 1, "ONLINE")


# ------------------------------------------------------------ period QĐ8 ----


def test_documents_of_previous_months_are_closed(documents, world, engine):
    old_day = previous_month_day(engine)
    service = documents("STOCK_RECEIPT")
    old = post_new(service, receipt_body((world.noodles, 5, 1000), business_date=old_day))
    with pytest.raises(ApiError) as error:
        service.cancel(int(old.id), "Nhập trùng", match(service, old))
    assert code(error) == "PERIOD_CLOSED"
    body = StockReceiptCorrection.model_validate(
        {
            "reason": "Sai giá",
            "lines": [{"productId": str(world.noodles), "quantity": "5", "unitPrice": "900"}],
        }
    )
    with pytest.raises(ApiError) as error:
        service.correct(int(old.id), body, match(service, old))
    assert code(error) == "PERIOD_CLOSED"
    # Boundary: the first day of the current month is open.
    first_day = today(engine).replace(day=1)
    current = post_new(service, receipt_body((world.noodles, 1, 1000), business_date=first_day))
    assert (
        service.cancel(int(current.id), "Nhập trùng", match(service, current)).status == "CANCELLED"
    )


def test_correction_cannot_move_into_a_closed_month(documents, world, engine, stocked):
    service = documents("STOCK_RECEIPT")
    body = StockReceiptCorrection.model_validate(
        {
            "reason": "Đổi ngày",
            "businessDate": previous_month_day(engine).isoformat(),
            "lines": [{"productId": str(world.noodles), "quantity": "100", "unitPrice": "100000"}],
        }
    )
    with pytest.raises(ApiError) as error:
        service.correct(int(stocked.id), body, match(service, stocked))
    assert code(error) == "PERIOD_CLOSED"


# ------------------------------------------------- database-level guards ----


def test_balances_cannot_be_written_outside_posting(engine, world, stocked):
    with engine.begin() as connection:
        with pytest.raises(DBAPIError):
            connection.execute(
                text("UPDATE dms.agency SET debt=1 WHERE id=:id"), {"id": world.agency}
            )
    with engine.begin() as connection:
        with pytest.raises(DBAPIError):
            connection.execute(
                text("UPDATE dms.product SET stock=1 WHERE id=:id"), {"id": world.noodles}
            )


def test_posted_lines_are_immutable(engine, stocked):
    with engine.begin() as connection:
        with pytest.raises(DBAPIError):
            connection.execute(
                text('UPDATE dms.document_line SET quantity=1 WHERE "documentId"=:id'),
                {"id": int(stocked.id)},
            )


def test_ward_capacity_rule_in_database(engine, world):
    """QĐ1: a ward holds at most maxAgenciesPerWard ACTIVE agencies (default 4)."""
    insert = text(
        'INSERT INTO dms.agency (name, "typeId", "wardId", "acceptedDate") '
        "VALUES (:n, 1, 1, '2025-01-02')"
    )
    with engine.begin() as connection:
        for index in range(3):  # ward 1 already holds one agency → boundary 4/4
            connection.execute(insert, {"n": f"Tạp hóa {index}"})
    with engine.begin() as connection:
        with pytest.raises(DBAPIError) as error:
            connection.execute(insert, {"n": "Tạp hóa thứ năm"})
    assert "capacity" in str(error.value)


def test_posting_is_audited_with_business_function(engine, world, stocked):
    with engine.connect() as connection:
        rows = connection.execute(
            text(
                'SELECT "functionCode", "actorId" FROM dms.audit_log '
                "WHERE \"entityName\"='product' AND action='UPDATE' ORDER BY id"
            )
        ).all()
    assert rows and {row[0] for row in rows} == {"stock.receipt.post"}
    assert {row[1] for row in rows} == {world.manager}
