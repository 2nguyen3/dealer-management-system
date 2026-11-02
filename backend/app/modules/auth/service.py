import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import AuthError
from app.core.logging import auth_logger as logger
from app.core.request_context import set_audit_context
from app.core.security import DUMMY_HASH, hash_password, verify_password
from app.modules.auth.delivery import SmtpResetDelivery, pad_reset_response
from app.modules.auth.models import AuthToken
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import CurrentUser, TokenResponse, to_user_response
from app.modules.auth.tokens import (
    decode_access_token,
    digest_opaque_token,
    encode_access_token,
    generate_opaque_token,
)
from app.modules.users.models import AppUser


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class Principal:
    user_id: int
    session_id: UUID
    version: int
    claims: dict = field(repr=False)


def invalidate_user_sessions(session: Session, user_id: int, now: datetime) -> None:
    # Future administration writers call this AFTER locking the user and updating it.
    AuthRepository(session).revoke_user_tokens(user_id, ("REFRESH", "PASSWORD_RESET"), now)


class AuthService:
    def __init__(
        self,
        session: Session,
        settings: Settings,
        delivery: SmtpResetDelivery,
        *,
        clock: Callable[[], datetime] = utc_now,
        monotonic: Callable[[], float] = time.monotonic,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        self.session = session
        self.settings = settings
        self.delivery = delivery
        self.clock = clock
        self.monotonic = monotonic
        self.sleeper = sleeper
        self.repo = AuthRepository(session)

    @contextmanager
    def transaction(self) -> Iterator[None]:
        try:
            yield
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise

    def require_active(self, user: AppUser) -> None:
        if user.status == "LOCKED":
            raise AuthError(403, "ACCOUNT_LOCKED", "Account is locked")

    def validate_token(self, user: AppUser, token: AuthToken | None, now: datetime) -> None:
        if (
            token is None
            or token.revoked_at is not None
            or token.expires_at <= now
            or token.auth_version != user.auth_version
        ):
            raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token")

    def lock_credential(self, raw: str, purpose: str) -> tuple[AppUser, AuthToken]:
        digest = digest_opaque_token(raw)
        owner = self.repo.find_token_owner(digest, purpose)
        user = None if owner is None else self.repo.lock_user(owner)
        if user is None:
            raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token")
        token = self.repo.lock_token(user.id, digest, purpose)
        if token is None:
            raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token")
        return user, token

    def issue_response(
        self, user: AppUser, sid: UUID, expiry: datetime, now: datetime
    ) -> TokenResponse:
        raw = generate_opaque_token()
        self.repo.insert_token(user, "REFRESH", digest_opaque_token(raw), expiry, sid)
        access, access_expiry = encode_access_token(
            self.settings, user.id, sid, user.auth_version, expiry, now
        )
        pair = self.repo.get_user_with_group(user.id)
        if pair is None:
            raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token")
        return TokenResponse(
            tokenType="Bearer",
            accessToken=access,
            expiresAt=access_expiry,
            refreshToken=raw,
            refreshExpiresAt=expiry,
            user=to_user_response(*pair),
        )

    def login(self, email: str, password: str) -> TokenResponse:
        with self.transaction():
            user = self.repo.find_user_by_email(email)
            encoded = DUMMY_HASH if user is None else user.password_hash
            version = None if user is None else user.auth_version
            valid = verify_password(password, encoded)
            if not valid or user is None:
                raise AuthError(401, "INVALID_CREDENTIALS", "Invalid credentials")
            user = self.repo.lock_user(user.id)
            if user is None or user.password_hash != encoded or user.auth_version != version:
                raise AuthError(401, "INVALID_CREDENTIALS", "Invalid credentials")
            self.require_active(user)
            now = self.clock()
            result = self.issue_response(
                user, uuid4(), now + timedelta(seconds=self.settings.auth_refresh_ttl_seconds), now
            )
        return result

    def refresh_tokens(self, raw: str) -> TokenResponse:
        with self.transaction():
            user, token = self.lock_credential(raw, "REFRESH")
            self.require_active(user)
            now = self.clock()
            self.validate_token(user, token, now)
            token.revoked_at = now
            self.session.flush()
            result = self.issue_response(user, token.session_id, token.expires_at, now)
        return result

    def logout(self, raw: str) -> None:
        with self.transaction():
            digest = digest_opaque_token(raw)
            owner = self.repo.find_token_owner(digest, "REFRESH")
            if owner is not None:
                user = self.repo.lock_user(owner)
                if user is not None:
                    token = self.repo.lock_token(owner, digest, "REFRESH")
                    if token is not None:
                        self.repo.revoke_session(owner, token.session_id, self.clock())

    def authenticate_claims(self, claims: dict, *, lock: bool = False) -> Principal:
        user_id, sid = int(claims["sub"]), UUID(claims["sid"])
        if lock:
            user = self.repo.lock_user(user_id)
        else:
            pair = self.repo.get_user_with_group(user_id)
            user = None if pair is None else pair[0]
        token = self.repo.live_session(user_id, sid)
        if user is None or token is None:
            raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token")
        self.require_active(user)
        now = self.clock()
        self.validate_token(user, token, now)
        if claims["ver"] != user.auth_version or now.timestamp() >= claims["exp"]:
            raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token")
        return Principal(user_id, sid, claims["ver"], claims)

    def authenticate(self, raw: str) -> Principal:
        return self.authenticate_claims(decode_access_token(self.settings, raw, self.clock()))

    def get_current_user(self, principal: Principal) -> CurrentUser:
        self.authenticate_claims(principal.claims)
        pair = self.repo.get_user_with_group(principal.user_id)
        if pair is None:
            raise AuthError(401, "INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token")
        return CurrentUser(
            user=to_user_response(*pair),
            allowedFunctions=self.repo.get_allowed_function_codes(pair[0].group_id),
        )

    def change_password(
        self, principal: Principal, current: str, new: str, request_id: str
    ) -> None:
        with self.transaction():
            self.authenticate_claims(principal.claims, lock=True)
            user = self.repo.lock_user(principal.user_id)
            if not verify_password(current, user.password_hash):
                raise AuthError(401, "INVALID_CREDENTIALS", "Invalid credentials")
            encoded = hash_password(new)
            set_audit_context(self.session, user.id, request_id)
            self.repo.update_password_hash(user, encoded)
            invalidate_user_sessions(self.session, user.id, self.clock())

    def request_password_reset(self, email: str) -> None:
        start = self.monotonic()
        if not self.delivery.available():
            raise AuthError(503, "SERVICE_UNAVAILABLE", "Password reset delivery unavailable", 60)
        try:
            raw = recipient = token_id = owner = None
            with self.transaction():
                user = self.repo.find_user_by_email(email)
                if user is not None:
                    user = self.repo.lock_user(user.id)
                    if user is not None and user.status == "ACTIVE":
                        now = self.clock()
                        self.repo.revoke_user_tokens(user.id, ("PASSWORD_RESET",), now)
                        raw = generate_opaque_token()
                        token = self.repo.insert_token(
                            user,
                            "PASSWORD_RESET",
                            digest_opaque_token(raw),
                            now + timedelta(seconds=self.settings.auth_reset_ttl_seconds),
                            None,
                        )
                        recipient, token_id, owner = user.email, token.id, user.id
            if raw is not None:
                try:
                    self.delivery.send(recipient, raw)
                except Exception:
                    logger.warning("Password reset delivery failed")
                    try:
                        with self.transaction():
                            self.repo.lock_user(owner)
                            token = self.repo.lock_token(
                                owner, digest_opaque_token(raw), "PASSWORD_RESET"
                            )
                            if (
                                token is not None
                                and token.id == token_id
                                and token.revoked_at is None
                            ):
                                token.revoked_at = self.clock()
                                self.session.flush()
                    except Exception:
                        logger.warning("Password reset delivery compensation failed")
        finally:
            pad_reset_response(
                start, self.settings.auth_reset_response_floor_seconds, self.monotonic, self.sleeper
            )

    def reset_password_with_token(self, raw: str, new: str, request_id: str) -> None:
        with self.transaction():
            user, token = self.lock_credential(raw, "PASSWORD_RESET")
            self.validate_token(user, token, self.clock())
            encoded = hash_password(new)
            set_audit_context(self.session, None, request_id)
            self.repo.update_password_hash(user, encoded)
            invalidate_user_sessions(self.session, user.id, self.clock())
