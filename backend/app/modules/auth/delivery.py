import smtplib
import ssl
import threading
import time
from collections.abc import Callable
from email.message import EmailMessage
from urllib.parse import quote, urlsplit

from email_validator import validate_email

from app.core.config import Settings


def build_reset_link(url: str, token: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.fragment:
        raise ValueError("Invalid reset URL")
    return f"{url}#token={quote(token, safe='')}"


def pad_reset_response(
    start: float,
    floor: float,
    clock: Callable[[], float] = time.monotonic,
    sleeper: Callable[[float], None] = time.sleep,
) -> None:
    remaining = floor - (clock() - start)
    if remaining > 0:
        sleeper(remaining)


class SmtpResetDelivery:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.slots = threading.BoundedSemaphore(4)

    def available(self) -> bool:
        return self.settings.auth_mail_enabled

    def send(self, recipient: str, token: str) -> None:
        validate_email(recipient, check_deliverability=False)
        if not self.slots.acquire(blocking=False):
            raise RuntimeError("Password reset delivery capacity reached")
        completed = threading.Event()
        failures: list[bool] = []

        def deliver() -> None:
            try:
                self._send(recipient, token)
            except Exception:
                failures.append(True)
            finally:
                self.slots.release()
                completed.set()

        # Bounded caller wait covers setup, SMTP commands and cleanup. Unknown
        # outcomes trigger token revocation even if the worker later delivers mail.
        worker = threading.Thread(target=deliver, name="auth-reset-delivery", daemon=True)
        try:
            worker.start()
        except Exception:
            self.slots.release()
            raise RuntimeError("Password reset delivery worker unavailable") from None
        if not completed.wait(self.settings.smtp_timeout_seconds):
            raise TimeoutError("Password reset delivery deadline exceeded")
        if failures:
            raise RuntimeError("Password reset delivery failed")

    def _send(self, recipient: str, token: str) -> None:
        settings = self.settings
        message = EmailMessage()
        message["From"] = settings.smtp_from
        message["To"] = recipient
        message["Subject"] = "Agentra password reset"
        message.set_content(
            "Reset your password using this single-use link:\n"
            + build_reset_link(settings.auth_reset_url, token)
        )
        context = ssl.create_default_context()
        client_type = smtplib.SMTP_SSL if settings.smtp_tls_mode == "ssl" else smtplib.SMTP
        options = {"timeout": settings.smtp_timeout_seconds}
        if settings.smtp_tls_mode == "ssl":
            options["context"] = context
        with client_type(settings.smtp_host, settings.smtp_port, **options) as client:
            if settings.smtp_tls_mode == "starttls":
                client.starttls(context=context)
            if settings.smtp_username:
                client.login(settings.smtp_username, settings.smtp_password.get_secret_value())
            client.send_message(message)
