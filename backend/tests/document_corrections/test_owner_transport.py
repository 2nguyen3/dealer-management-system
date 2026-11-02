from importlib import import_module
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from fastapi import Response


@pytest.mark.parametrize(
    "module,singular,plural,update,correction_class,action",
    [
        (
            "stock_receipts",
            "stock_receipt",
            "stock_receipts",
            "update_stock_receipt_draft",
            "GoodsCorrectionService",
            "cancel_document",
        ),
        (
            "stock_adjustments",
            "stock_adjustment",
            "stock_adjustments",
            "update_stock_adjustment_draft",
            "GoodsCorrectionService",
            "cancel_document",
        ),
        (
            "payment_receipts",
            "payment_receipt",
            "payment_receipts",
            "update_payment_receipt",
            "ManualReceiptCorrectionService",
            "cancel",
        ),
        (
            "stock_issues",
            "stock_issue",
            "stock_issues",
            "update_stock_issue",
            "IssueCorrectionService",
            "cancel",
        ),
        (
            "sales_returns",
            "sales_return",
            "sales_returns",
            "update_sales_return",
            "ReturnCorrectionService",
            "cancel",
        ),
        (
            "credit_applications",
            "credit_application",
            "credit_applications",
            "update_credit_application",
            "CreditCorrectionService",
            "cancel",
        ),
    ],
)
def test_owner_handlers_delegate_and_preserve_transport(
    module, singular, plural, update, correction_class, action
):
    router = import_module(f"app.modules.{module}.router")
    service, principal, body, request = Mock(), Mock(), Mock(), Mock()
    condition, key = Mock(), uuid4()
    item = Mock()
    service.get.return_value = item
    service.update.return_value = item
    service.etag.return_value = '"owner-etag"'
    result = SimpleNamespace(body={"id": "7"}, status=201, headers={"ETag": '"result-etag"'})
    for name in ("create", "post"):
        getattr(service, name).return_value = result
    service.list.return_value = [item]
    with patch.object(router, "read_preconditions", return_value=condition):
        listed = getattr(router, f"list_{plural}")(principal=principal, service=service)
        assert listed == [item]
        assert service.list.call_args.kwargs["limit"] == 25
        response = Response()
        assert getattr(router, f"get_{singular}")("7", principal, service, response) is item
        service.get.assert_called_once_with(7)
        assert response.headers["ETag"] == '"owner-etag"'
        created = getattr(router, f"create_{singular}")(body, principal, service, key)
        assert created.status_code == 201 and created.headers["ETag"] == '"result-etag"'
        service.create.assert_called_once_with(body, key)
        changed = getattr(router, update)(
            "7", body, principal, service, request, response, '"match"'
        )
        assert changed is item and response.headers["ETag"] == '"owner-etag"'
        service.update.assert_called_once_with(7, body, condition)
        posted = getattr(router, f"post_{singular}")(
            "7", principal, service, request, '"match"', key
        )
        assert posted.status_code == 201
        service.post.assert_called_once_with(7, condition, key)
        if module == "stock_issues":
            service.submit.return_value = result
            submitted = router.submit_stock_issue("7", principal, service, request, '"match"', key)
            assert submitted.status_code == 201
            service.submit.assert_called_once_with(7, condition, key)
            service.replace_pending.return_value = result
            revised = router.replace_pending_stock_issue(
                "7", body, principal, service, request, '"match"', key
            )
            assert revised.status_code == 201
            service.replace_pending.assert_called_once_with(7, body, condition, key)
        with patch.object(router, correction_class) as correction:
            correction.return_value.correct.return_value = result
            getattr(correction.return_value, action).return_value = result
            for name, method in (("correct", "correct"), ("cancel", action)):
                response = getattr(router, f"{name}_{singular}")(
                    "7", body, principal, service, request, '"match"', key
                )
                assert response.status_code == result.status
                assert response.body == b'{"id":"7"}'
                assert response.headers["ETag"] == '"result-etag"'
                getattr(correction.return_value, method).assert_called_once_with(
                    7, body, condition, key
                )


@pytest.mark.parametrize(
    "module,singular,correction_class",
    [
        ("stock_issues", "stock_issue", "IssueCorrectionService"),
        ("sales_returns", "sales_return", "ReturnCorrectionService"),
        ("credit_applications", "credit_application", "CreditCorrectionService"),
    ],
)
def test_financial_correction_handlers_preserve_command_transport(
    module, singular, correction_class
):
    router = import_module(f"app.modules.{module}.router")
    service, principal, body, request, condition = (Mock() for _ in range(5))
    key = uuid4()
    with (
        patch.object(router, "read_preconditions", return_value=condition),
        patch.object(router, correction_class) as factory,
    ):
        for action, status in (("correct", 201), ("cancel", 200)):
            result = SimpleNamespace(body={"id": "7"}, status=status, headers={"ETag": '"current"'})
            getattr(factory.return_value, action).return_value = result
            response = getattr(router, f"{action}_{singular}")(
                "7", body, principal, service, request, '"match"', key
            )
            assert response.status_code == status and response.body == b'{"id":"7"}'
            assert response.headers["ETag"] == '"current"'
            getattr(factory.return_value, action).assert_called_once_with(7, body, condition, key)
