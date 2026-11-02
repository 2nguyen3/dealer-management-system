import threading
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock, patch

import pytest

from app.core.exceptions import AuthError
from app.modules.auth.delivery import SmtpResetDelivery, build_reset_link, pad_reset_response
from app.modules.auth.dependencies import require_permissions
from app.modules.auth.rate_limit import AuthRateLimiter, build_rate_limit_key


def test_limiter_boundaries_capacity_and_cleanup():
    clock = Mock(return_value=0.0)
    limiter = AuthRateLimiter(1, clock)
    limiter.check("first", 2, 10)
    limiter.check("first", 2, 10)
    with pytest.raises(AuthError) as caught:
        limiter.check("first", 2, 10)
    assert caught.value.retry_after == 10
    with pytest.raises(AuthError):
        limiter.check("second", 2, 10)
    clock.return_value = 9.9
    with pytest.raises(AuthError) as caught:
        limiter.check("first", 2, 10)
    assert caught.value.retry_after == 1
    clock.return_value = 10
    limiter.check("second", 2, 10)
    assert set(limiter.buckets) == {"second"}


def test_limiter_thread_atomicity_and_safe_key():
    limiter = AuthRateLimiter(100)

    def admit(_):
        try:
            limiter.check("same", 10, 60)
            return True
        except AuthError:
            return False

    with ThreadPoolExecutor(max_workers=20) as pool:
        assert sum(pool.map(admit, range(100))) == 10
    a = build_rate_limit_key("login", "localhost", "Employee@example.com", secret=b"secret")
    assert a == build_rate_limit_key("login", "localhost", "EMPLOYEE@example.com", secret=b"secret")
    assert "Employee" not in a and "example.com" not in a
    assert build_rate_limit_key("login", "localhost") != a


def test_reset_link_and_padding():
    assert (
        build_reset_link("https://example.com/reset?lang=en", "a/+ b")
        == "https://example.com/reset?lang=en#token=a%2F%2B%20b"
    )
    for invalid in ("/relative", "https://example.com/#existing", "file:///tmp"):
        with pytest.raises(ValueError):
            build_reset_link(invalid, "secret")
    sleeper = Mock()
    pad_reset_response(0, 6, lambda: 2, sleeper)
    sleeper.assert_called_once_with(4)
    sleeper.reset_mock()
    pad_reset_response(0, 6, lambda: 10, sleeper)
    sleeper.assert_not_called()


@pytest.mark.parametrize("mode", ["starttls", "ssl"])
@pytest.mark.parametrize("credentials", [False, True])
def test_smtp_tls_order_and_cleanup(settings, mode, credentials):
    settings.smtp_tls_mode = mode
    settings.smtp_host = "mail.example.com"
    settings.smtp_from = "sender@example.com"
    settings.auth_reset_url = "https://example.com/reset"
    if credentials:
        settings.smtp_username = "synthetic-user"
        from pydantic import SecretStr

        settings.smtp_password = SecretStr("synthetic-secret")
    adapter = SmtpResetDelivery(settings)
    assert not adapter.available()
    settings.auth_mail_enabled = True
    assert adapter.available()
    target = (
        "app.modules.auth.delivery.smtplib.SMTP_SSL"
        if mode == "ssl"
        else "app.modules.auth.delivery.smtplib.SMTP"
    )
    with patch(target) as constructor:
        client = constructor.return_value.__enter__.return_value
        adapter.send("employee@example.com", "reset-sentinel")
        message = client.send_message.call_args.args[0]
        assert message["To"] == "employee@example.com"
        assert "#token=reset-sentinel" in message.get_content()
        names = [call[0] for call in client.mock_calls]
        if mode == "starttls":
            assert names.index("starttls") < names.index("send_message")
        if credentials:
            assert names.index("login") < names.index("send_message")
        assert constructor.call_args.kwargs["timeout"] == 5
        client.send_message.side_effect = RuntimeError("secret")
        with pytest.raises(RuntimeError):
            adapter.send("employee@example.com", "reset-sentinel")
        assert constructor.return_value.__exit__.call_count == 2
    with pytest.raises(ValueError):
        adapter.send("victim@example.com\r\nBcc: leak@example.com", "reset-sentinel")


def test_permission_policy_definition():
    with pytest.raises(ValueError):
        require_permissions()
    with pytest.raises(ValueError):
        require_permissions(all_of=("typo",))


def test_smtp_deadline_capacity_and_worker_failure(settings):
    settings.smtp_timeout_seconds = 0.01
    adapter = SmtpResetDelivery(settings)
    entered, release, finished = threading.Event(), threading.Event(), threading.Event()

    def stalled(recipient, token):
        entered.set()
        release.wait(2)
        finished.set()

    with patch.object(adapter, "_send", side_effect=stalled):
        try:
            with pytest.raises(TimeoutError):
                adapter.send("employee@example.com", "synthetic")
            assert entered.is_set()
        finally:
            release.set()
            assert finished.wait(2)
    for _ in range(4):
        adapter.slots.acquire()
    with pytest.raises(RuntimeError, match="capacity"):
        adapter.send("employee@example.com", "synthetic")
    for _ in range(4):
        adapter.slots.release()
    with (
        patch(
            "app.modules.auth.delivery.threading.Thread.start", side_effect=RuntimeError("sentinel")
        ),
        pytest.raises(RuntimeError, match="unavailable"),
    ):
        adapter.send("employee@example.com", "synthetic")
    assert adapter.slots.acquire(blocking=False)
    adapter.slots.release()


@pytest.mark.parametrize(
    "allowed,all_of,any_of,success",
    [
        (["agency.read"], ("agency.read",), (), True),
        ([], ("agency.read",), (), False),
        (["agency.read"], (), ("agency.read", "inventory.read"), True),
        ([], (), ("agency.read",), False),
        (["agency.read"], ("agency.read",), ("inventory.read",), False),
        (["agency.read", "inventory.read"], ("agency.read",), ("inventory.read",), True),
    ],
)
def test_permission_truth_table(allowed, all_of, any_of, success):
    dependency = require_permissions(all_of=all_of, any_of=any_of)
    principal, service = Mock(), Mock()
    service.get_current_user.return_value.allowedFunctions = allowed
    if success:
        assert dependency(principal, service) is principal
    else:
        with pytest.raises(AuthError) as caught:
            dependency(principal, service)
        assert caught.value.status == 403
