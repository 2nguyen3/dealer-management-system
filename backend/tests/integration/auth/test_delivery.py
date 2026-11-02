import asyncio
import socket
import ssl
import threading
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from aiosmtpd.controller import Controller
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from sqlalchemy import text

from app.modules.auth.delivery import SmtpResetDelivery
from app.modules.auth.service import AuthService

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("mode", ["starttls", "ssl"])
@pytest.mark.parametrize("slow", [False, True])
def test_local_tls_smtp_capture(settings, tmp_path, mode, slow, session, user):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(UTC) - timedelta(minutes=1))
        .not_valid_after(datetime.now(UTC) + timedelta(days=1))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")]), critical=False)
        .sign(key, hashes.SHA256())
    )
    cert_path, key_path = tmp_path / "certificate.pem", tmp_path / "key.pem"
    cert_path.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    server_context.load_cert_chain(cert_path, key_path)
    client_context = ssl.create_default_context(cafile=str(cert_path))
    captured, received = [], threading.Event()
    release = asyncio.Event()

    class Sink:
        async def handle_MAIL(self, server, smtp_session, envelope, address, mail_options):
            envelope.mail_from = address
            envelope.mail_options.extend(mail_options)
            return "250 OK"

        async def handle_RCPT(self, server, smtp_session, envelope, address, rcpt_options):
            envelope.rcpt_tos.append(address)
            envelope.rcpt_options.extend(rcpt_options)
            return "250 OK"

        async def handle_DATA(self, server, session, envelope):
            assert session.ssl is not None or mode == "ssl"
            captured.append(envelope)
            received.set()
            if slow:
                # The acknowledgement is withheld until the caller has timed out.
                # Events establish ordering; no guessed millisecond sleep threshold.
                await release.wait()
            return "250 Message accepted"

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    options = (
        {"ssl_context": server_context}
        if mode == "ssl"
        else {"tls_context": server_context, "require_starttls": True}
    )
    controller = Controller(Sink(), hostname="localhost", port=port, **options)
    controller.start()
    try:
        settings.smtp_host, settings.smtp_port, settings.smtp_tls_mode = "localhost", port, mode
        settings.smtp_from = "sender@example.com"
        settings.auth_reset_url = "https://example.com/reset"
        settings.smtp_timeout_seconds = 5
        settings.auth_reset_response_floor_seconds = 6
        settings.auth_mail_enabled = True
        with patch(
            "app.modules.auth.delivery.ssl.create_default_context", return_value=client_context
        ):
            if slow:
                AuthService(session, settings, SmtpResetDelivery(settings)).request_password_reset(
                    "employee@example.com"
                )
                assert (
                    session.scalar(
                        text('SELECT count(*) FROM dms.auth_token WHERE "revokedAt" IS NOT NULL')
                    )
                    == 1
                )
            else:
                SmtpResetDelivery(settings).send("employee@example.com", "synthetic-reset-token")
        assert received.wait(2)
        assert captured[0].mail_from == "sender@example.com"
        assert captured[0].rcpt_tos == ["Employee@example.com" if slow else "employee@example.com"]
        assert b"#token=" in captured[0].content
        if not slow:
            assert b"#token=synthetic-reset-token" in captured[0].content
    finally:
        controller.loop.call_soon_threadsafe(release.set)
        controller.stop()
