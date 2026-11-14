"""DocumentHistoryService on real PostgreSQL: search, detail, chain and per-kind access."""

from datetime import timedelta

import pytest

from app.core.exceptions import ApiError, AuthError
from app.modules.document_core.schemas import (
    PaymentReceiptCorrection,
    StockIssueCorrection,
)
from app.modules.document_history.service import ANY_READ
from tests.integration.document_history.conftest import issue_body, match, post_new

pytestmark = pytest.mark.integration

MANAGER = ANY_READ
SALES = ("agency.read", "agency.manage", "stock.issue.prepare", "sales.read", "debt.read")
WAREHOUSE = ("product.manage", "stock.receipt.prepare", "stock.receipt.post", "stock.issue.post")


def codes(page):
    return {item.code for item in page.items}


def ids(*documents):
    return {document.code for document in documents}


# --------------------------------------------------------------- search ----


def test_search_returns_every_kind_newest_first(histories, history):
    page = histories(MANAGER).search()
    assert [item.code for item in page.items] == [
        # Same-day ties are ordered by id descending.
        history.draft.code,
        history.payment.code,
        history.issue.code,
        history.receipt.code,
    ]
    assert page.pagination.hasMore is False and page.pagination.nextCursor is None
    payment = next(item for item in page.items if item.kind == "PAYMENT_RECEIPT")
    assert payment.receiptType == "CASH" and payment.lineCount == 0
    assert payment.agencyName == "Tạp hóa Hồng Phúc" and payment.totalAmount == 50000


@pytest.mark.parametrize(
    "filters,expected",
    [
        ({"kind": "STOCK_ISSUE"}, ("issue", "draft")),
        ({"kind": "STOCK_RECEIPT"}, ("receipt",)),
        ({"status": "DRAFT"}, ("draft",)),
        ({"status": "CANCELLED"}, ()),
        ({"receiptType": "CASH"}, ("payment",)),
    ],
)
def test_search_by_kind_status_and_receipt_type(histories, history, filters, expected):
    page = histories(MANAGER).search(**filters)
    assert codes(page) == {getattr(history, name).code for name in expected}


def test_search_by_agency_product_code_and_text(histories, history, world):
    service = histories(MANAGER)
    assert codes(service.search(agencyId=str(world.agency))) == ids(history.issue, history.payment)
    assert codes(service.search(agencyId=str(world.second_agency))) == ids(history.draft)
    assert codes(service.search(agencyId=str(world.terminated))) == set()
    assert codes(service.search(productId=str(world.rice))) == ids(history.receipt, history.draft)
    assert codes(service.search(productId=str(world.noodles))) == ids(
        history.receipt, history.issue
    )
    assert codes(service.search(productId=str(world.unpriced))) == set()
    assert codes(service.search(code=history.issue.code)) == ids(history.issue)
    assert codes(service.search(code="PX-999999")) == set()
    assert codes(service.search(q="hồng phúc")) == ids(history.issue, history.payment)
    assert codes(service.search(q="lô đầu")) == ids(history.receipt)
    # Wildcards are literal, not patterns.
    assert codes(service.search(q="%")) == set()


def test_search_by_creator_and_poster(histories, history, world):
    service = histories(MANAGER)
    assert codes(service.search(createdBy=str(world.clerk))) == ids(history.payment)
    assert codes(service.search(postedBy=str(world.clerk))) == ids(history.payment)
    assert codes(service.search(postedBy=str(world.manager))) == ids(history.receipt, history.issue)
    assert history.payment.createdByName == "Kế toán"


def test_search_date_bounds_are_inclusive_from_and_exclusive_to(histories, history):
    service = histories(MANAGER)
    day = history.day
    assert codes(service.search(fromDate=day)) == ids(history.payment, history.draft)
    assert codes(service.search(fromDate=day - timedelta(days=1))) == ids(
        history.issue, history.payment, history.draft
    )
    assert codes(service.search(toDate=day - timedelta(days=1))) == ids(history.receipt)
    assert codes(service.search(fromDate=day - timedelta(days=1), toDate=day)) == ids(history.issue)
    assert codes(service.search(fromDate=day + timedelta(days=1))) == set()
    for start, end in ((day, day), (day, day - timedelta(days=1))):
        with pytest.raises(ApiError) as error:
            service.search(fromDate=start, toDate=end)
        assert error.value.status == 422 and error.value.code == "VALIDATION_FAILED"


@pytest.mark.parametrize("sort", ["id", "-totalAmount", "businessDate", "-postedAt"])
def test_search_cursor_pagination_is_complete_and_scoped(histories, history, sort):
    service = histories(MANAGER)
    first = service.search(limit=3, sort=sort)
    assert len(first.items) == 3 and first.pagination.hasMore
    second = service.search(limit=3, sort=sort, cursor=first.pagination.nextCursor)
    assert len(second.items) == 1 and not second.pagination.hasMore
    assert codes(first) | codes(second) == ids(
        history.receipt, history.issue, history.payment, history.draft
    )
    # A cursor is bound to its filters.
    with pytest.raises(ApiError) as error:
        service.search(limit=3, sort=sort, kind="STOCK_ISSUE", cursor=first.pagination.nextCursor)
    assert error.value.status == 400


def test_search_hides_kinds_the_user_cannot_read(histories, history):
    assert codes(histories(SALES).search()) == ids(history.issue, history.payment, history.draft)
    assert codes(histories(WAREHOUSE).search()) == ids(
        history.receipt, history.issue, history.draft
    )
    # A text match on a hidden kind is still hidden.
    assert codes(histories(SALES).search(q="lô đầu")) == set()
    with pytest.raises(AuthError) as error:
        histories(SALES).search(kind="STOCK_RECEIPT")
    assert error.value.status == 403
    with pytest.raises(AuthError):
        histories(WAREHOUSE).search(kind="PAYMENT_RECEIPT")
    with pytest.raises(AuthError):
        histories(("agency.read",)).search()


# ---------------------------------------------------------------- detail ----


def test_get_returns_full_document_of_each_kind(histories, history, world):
    service = histories(MANAGER)
    receipt = service.get(int(history.receipt.id))
    assert receipt.kind == "STOCK_RECEIPT" and receipt.agencyId is None
    assert [line.productName for line in receipt.lines] == [
        "Mì Hảo Hảo thùng 30 gói",
        "Gạo ST25",
    ]
    assert receipt.totalAmount == 100 * 100000 + 50 * 20000
    issue = service.get(int(history.issue.id))
    assert issue.lines[0].unitPrice == 102000 and issue.sellingPriceRate is not None
    assert issue.agencyDebt == 2 * 102000 - 50000
    payment = service.get(int(history.payment.id))
    assert payment.lines == [] and payment.totalAmount == 50000
    draft = service.get(int(history.draft.id))
    assert draft.status == "DRAFT" and draft.postedAt is None
    # Same projection and ETag as the kind's own route (debt moved with the payment).
    volatile = {"agencyDebt", "agencyMaxDebt"}
    assert issue.model_dump(exclude=volatile) == history.issue.model_dump(exclude=volatile)
    assert service.etag(issue) == service.core("STOCK_ISSUE").etag(history.issue)


def test_get_missing_and_forbidden(histories, history):
    with pytest.raises(ApiError) as error:
        histories(MANAGER).get(999_999)
    assert error.value.status == 404 and error.value.code == "NOT_FOUND"
    with pytest.raises(AuthError) as denied:
        histories(SALES).get(int(history.receipt.id))
    assert denied.value.status == 403
    with pytest.raises(AuthError):
        histories(WAREHOUSE).get(int(history.payment.id))
    assert histories(SALES).get(int(history.payment.id)).code == history.payment.code


# ----------------------------------------------------------------- chain ----


def correct_issue(service, document, quantity, reason):
    body = StockIssueCorrection.model_validate(
        {
            "reason": reason,
            "lines": [{"productId": document.lines[0].productId, "quantity": quantity}],
        }
    )
    return service.correct(int(document.id), body, match(service, document))


def test_chain_of_two_successive_corrections(documents, histories, history, world):
    issues = documents("STOCK_ISSUE")
    original = post_new(issues, issue_body(world.agency, (world.noodles, 5)))
    first = correct_issue(issues, original, "6", "Giao thêm 1 thùng")
    second = correct_issue(issues, first, "4", "Đại lý trả lại 2 thùng ngay khi giao")
    service = histories(MANAGER)
    expected = [original.code, first.code, second.code]
    for member in (original, first, second):
        chain = service.chain(int(member.id))
        assert [item.code for item in chain.items] == expected
    items = service.chain(int(first.id)).items
    assert [item.status for item in items] == ["CANCELLED", "CANCELLED", "POSTED"]
    assert [item.cancelReason for item in items] == [
        "Giao thêm 1 thùng",
        "Đại lý trả lại 2 thùng ngay khi giao",
        None,
    ]
    assert items[0].replacesDocumentId is None and items[0].replacedByDocumentId == first.id
    assert items[1].replacesDocumentId == original.id
    assert items[1].replacedByDocumentId == second.id
    assert items[2].replacesDocumentId == first.id and items[2].replacedByDocumentId is None
    assert [item.totalAmount for item in items] == [5 * 102000, 6 * 102000, 4 * 102000]
    # The latest replacement links back; the original links forward.
    assert service.get(int(second.id)).replaces.code == first.code
    assert service.get(int(original.id)).replacedBy.code == first.code


def test_chain_of_an_uncorrected_document_is_itself(histories, history):
    service = histories(MANAGER)
    for document in (history.receipt, history.draft):
        chain = service.chain(int(document.id))
        assert [item.code for item in chain.items] == [document.code]
        assert chain.items[0].cancelReason is None


def test_chain_of_a_cancelled_payment_shows_reason(documents, histories, history, world):
    payments = documents("PAYMENT_RECEIPT")
    payment = payments.get(int(history.payment.id))
    cancelled = payments.cancel(int(payment.id), "Thu nhầm đại lý", match(payments, payment))
    chain = histories(SALES).chain(int(cancelled.id))
    assert [(item.code, item.status, item.cancelReason) for item in chain.items] == [
        (payment.code, "CANCELLED", "Thu nhầm đại lý")
    ]


def test_chain_of_a_corrected_payment(documents, histories, history):
    payments = documents("PAYMENT_RECEIPT")
    payment = payments.get(int(history.payment.id))
    body = PaymentReceiptCorrection.model_validate({"reason": "Sai số tiền", "amount": "60000"})
    replacement = payments.correct(int(payment.id), body, match(payments, payment))
    chain = histories(SALES).chain(int(payment.id))
    assert [item.code for item in chain.items] == [payment.code, replacement.code]


def test_chain_missing_and_forbidden(histories, history):
    with pytest.raises(ApiError) as error:
        histories(MANAGER).chain(999_999)
    assert error.value.status == 404
    with pytest.raises(AuthError) as denied:
        histories(SALES).chain(int(history.receipt.id))
    assert denied.value.status == 403
