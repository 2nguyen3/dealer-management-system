import hashlib
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from pydantic import ValidationError

from app.core.config import Settings, validate_auth_startup_settings
from app.core.exceptions import AuthError
from app.core.security import hash_password, verify_password
from app.modules.auth.schemas import LoginRequest, PasswordResetRequest, RefreshRequest
from app.modules.auth.tokens import (
    decode_access_token,
    digest_opaque_token,
    encode_access_token,
    generate_opaque_token,
)


@pytest.mark.parametrize("password", ["x", " ", "密碼🙂"])
def test_real_password_round_trip(password):
    encoded = hash_password(password)
    assert encoded.startswith("$argon2id$")
    assert verify_password(password, encoded)
    assert not verify_password(password + "wrong", encoded)
    assert hash_password(password) != encoded


@pytest.mark.parametrize("encoded", ["", "not-a-hash", "$argon2id$broken", "$bcrypt$bad"])
def test_bad_hash_fails_closed(encoded):
    assert not verify_password("sentinel", encoded)


def test_opaque_tokens_exact_digest():
    first, second = generate_opaque_token(), generate_opaque_token()
    assert first != second
    assert len(first) == 43 and "=" not in first
    assert digest_opaque_token("abc") == hashlib.sha256(b"abc").digest()
    assert len(digest_opaque_token(first)) == 32
    assert digest_opaque_token("abc") != digest_opaque_token(" abc")


def test_access_round_trip_and_expiry(settings):
    now = datetime(2026, 10, 1, tzinfo=UTC)
    raw, expiry = encode_access_token(
        settings, 9007199254740993, uuid4(), 1, now + timedelta(seconds=10), now
    )
    claims = decode_access_token(settings, raw, now)
    assert claims["sub"] == "9007199254740993"
    assert set(claims) == {"sub", "sid", "ver", "iss", "aud", "iat", "exp", "jti", "token_use"}
    assert expiry == now + timedelta(seconds=10)
    decode_access_token(settings, raw, expiry - timedelta(microseconds=1))
    with pytest.raises(AuthError):
        decode_access_token(settings, raw, expiry)
    with pytest.raises(AuthError):
        decode_access_token(settings, raw + "tampered", now)


@pytest.mark.parametrize(
    "claim,value",
    [
        ("sub", "0"),
        ("sub", "01"),
        ("sub", "9223372036854775808"),
        ("sub", True),
        ("ver", True),
        ("ver", 0),
        ("iat", True),
        ("exp", "9999999999"),
        ("sid", "bad"),
        ("sid", 1),
        ("jti", None),
        ("token_use", "refresh"),
        ("iss", "wrong"),
        ("aud", ["agentra-ui"]),
    ],
)
def test_claim_manipulation(settings, claim, value):
    now = datetime.now(UTC)
    raw, _ = encode_access_token(settings, 1, uuid4(), 1, now + timedelta(days=1), now)
    claims = jwt.decode(raw, options={"verify_signature": False})
    claims[claim] = value
    forged = jwt.encode(claims, settings.auth_signing_key.get_secret_value(), algorithm="HS256")
    with pytest.raises(AuthError):
        decode_access_token(settings, forged, now)


def test_strict_schema_preserves_input():
    body = LoginRequest(email="Mixed@EXAMPLE.com", password=" 密碼 ")
    assert body.email == "Mixed@EXAMPLE.com" and body.password == " 密碼 "
    assert "密碼" not in repr(body)
    assert RefreshRequest(refreshToken="not-43-chars").refreshToken == "not-43-chars"
    assert PasswordResetRequest(token="x", newPassword=" ").newPassword == " "


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"email": "user@example.com", "password": ""},
        {"email": " user@example.com", "password": "sentinel"},
        {"email": "bad", "password": "sentinel"},
        {"email": "a@b", "password": "sentinel"},
        {"email": "user@example.com", "password": 1},
        {"email": "user@example.com", "password": None},
        {"email": "user@example.com", "password": "sentinel", "extra": "sentinel"},
    ],
)
def test_strict_schema_rejects_without_echo(body):
    with pytest.raises(ValidationError) as caught:
        LoginRequest.model_validate(body)
    assert "sentinel" not in str(caught.value)


def test_startup_key_and_db_only_settings(settings):
    validate_auth_startup_settings(settings)
    db_only = Settings(_env_file=None, db_host="localhost", db_user="test", db_password="test")
    with pytest.raises(ValueError, match="AUTH_SIGNING_KEY"):
        validate_auth_startup_settings(db_only)


@pytest.mark.parametrize(
    "overrides",
    [
        {"auth_access_ttl_seconds": 0},
        {"auth_refresh_ttl_seconds": 1},
        {"smtp_username": "user"},
        {"auth_reset_url": "https://example.com/#token"},
        {"auth_reset_url": "file:///tmp"},
        {"auth_mail_enabled": True},
        {"smtp_tls_mode": "none"},
        {"auth_reset_response_floor_seconds": 5},
    ],
)
def test_invalid_settings(settings, overrides):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **(settings.model_dump() | overrides))


def test_enabled_mail_settings_and_secret_safe_failures(settings):
    base = settings.model_dump() | {
        "auth_mail_enabled": True,
        "smtp_host": "mail.example.com",
        "smtp_from": "sender@example.com",
        "auth_reset_url": "https://example.com/reset",
    }
    valid = Settings(_env_file=None, **base)
    assert valid.smtp_host == "mail.example.com"
    assert "synthetic-test-key" not in repr(valid)
    for override in (
        {"smtp_host": "mail\r\ninjected"},
        {"smtp_from": "bad"},
        {"auth_reset_url": "https://user:secret-sentinel@example.com/reset"},
    ):
        with pytest.raises(ValidationError) as caught:
            Settings(_env_file=None, **(base | override))
        assert "secret-sentinel" not in str(caught.value)


def test_cached_settings_loader_uses_environment(monkeypatch):
    from app.core.config import get_settings

    for key, value in {
        "DB_HOST": "localhost",
        "DB_USER": "synthetic",
        "DB_PASSWORD": "synthetic",
        "AUTH_MAIL_ENABLED": "false",
        "SMTP_USERNAME": "",
        "SMTP_PASSWORD": "",
    }.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    try:
        first = get_settings()
        assert get_settings() is first
        assert first.db_host == "localhost"
    finally:
        get_settings.cache_clear()


def test_fractional_session_expiry_rejected(settings):
    now = datetime(2026, 10, 1, microsecond=100000, tzinfo=UTC)
    with pytest.raises(AuthError):
        encode_access_token(settings, 1, uuid4(), 1, now + timedelta(milliseconds=600), now)


def test_permission_response_uniqueness_and_bigint(settings):
    from types import SimpleNamespace

    from app.modules.auth.schemas import CurrentUser, to_user_response

    user = SimpleNamespace(
        id=9007199254740993,
        full_name="Employee",
        email="employee@example.com",
        status="ACTIVE",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    group = SimpleNamespace(id=1, code="MANAGEMENT", name="Management")
    projected = to_user_response(user, group)
    assert projected.id == "9007199254740993"
    assert CurrentUser(user=projected, allowedFunctions=[]).allowedFunctions == []
    for codes in (["agency.read", "agency.read"], ["unknown"]):
        with pytest.raises(ValidationError):
            CurrentUser(user=projected, allowedFunctions=codes)
