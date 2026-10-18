import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt

from app.core.config import Settings
from app.core.exceptions import AuthError


def generate_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def digest_opaque_token(raw: str) -> bytes:
    return hashlib.sha256(raw.encode("utf-8")).digest()


def encode_access_token(
    settings: Settings,
    user_id: int,
    session_id: UUID,
    version: int,
    session_expiry: datetime,
    now: datetime,
) -> tuple[str, datetime]:
    expiry = min(now + timedelta(seconds=settings.auth_access_ttl_seconds), session_expiry)
    # JWT NumericDate has second precision; response reports that exact expiry.
    expiry = datetime.fromtimestamp(int(expiry.timestamp()), UTC)
    if expiry.timestamp() <= now.timestamp():
        raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token")
    claims = {
        "sub": str(user_id),
        "sid": str(session_id),
        "ver": version,
        "iss": settings.auth_issuer,
        "aud": settings.auth_audience,
        "iat": int(now.timestamp()),
        "exp": int(expiry.timestamp()),
        "jti": str(uuid4()),
        "token_use": "access",
    }
    return jwt.encode(
        claims, settings.auth_signing_key.get_secret_value(), algorithm="HS256"
    ), expiry


def decode_access_token(settings: Settings, raw: str, now: datetime) -> dict:
    try:
        header = jwt.get_unverified_header(raw)
        if header.get("alg") != "HS256" or "kid" in header:
            raise ValueError
        claims = jwt.decode(
            raw,
            settings.auth_signing_key.get_secret_value(),
            algorithms=["HS256"],
            issuer=settings.auth_issuer,
            audience=settings.auth_audience,
            options={
                "require": ["sub", "sid", "ver", "iss", "aud", "iat", "exp", "jti", "token_use"],
                "verify_exp": False,
                "verify_iat": False,
                "verify_nbf": False,
            },
        )
        if not isinstance(claims["sub"], str) or not re.fullmatch(r"[1-9][0-9]*", claims["sub"]):
            raise ValueError
        if int(claims["sub"]) > 9223372036854775807:
            raise ValueError
        for name in ("ver", "iat", "exp"):
            if type(claims[name]) is not int:
                raise ValueError
        if (
            claims["ver"] < 1
            or claims["exp"] <= claims["iat"]
            or now.timestamp() >= claims["exp"]
            or claims["iat"] > now.timestamp()
            or claims["token_use"] != "access"
            or claims["aud"] != settings.auth_audience
        ):
            raise ValueError
        for name in ("sid", "jti"):
            if not isinstance(claims[name], str):
                raise ValueError
            UUID(claims[name])
        return claims
    except (jwt.PyJWTError, ValueError, TypeError, KeyError, OverflowError):
        raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token") from None
