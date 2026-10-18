from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.auth.models import AppFunction, AuthToken, GroupPermission
from app.modules.user_groups.models import UserGroup
from app.modules.users.models import AppUser


class AuthRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def find_user_by_email(self, email: str) -> AppUser | None:
        return self.session.scalar(
            select(AppUser)
            .where(func.lower(AppUser.email) == func.lower(email))
            .execution_options(populate_existing=True)
        )

    def get_user_with_group(self, user_id: int) -> tuple[AppUser, UserGroup] | None:
        row = self.session.execute(
            select(AppUser, UserGroup)
            .join(UserGroup, UserGroup.id == AppUser.group_id)
            .where(AppUser.id == user_id)
            .execution_options(populate_existing=True)
        ).one_or_none()
        return None if row is None else (row[0], row[1])

    def find_token_owner(self, digest: bytes, purpose: str) -> int | None:
        return self.session.scalar(
            select(AuthToken.user_id).where(
                AuthToken.token_digest == digest, AuthToken.purpose == purpose
            )
        )

    def lock_user(self, user_id: int) -> AppUser | None:
        return self.session.scalar(
            select(AppUser)
            .where(AppUser.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def lock_token(self, user_id: int, digest: bytes, purpose: str) -> AuthToken | None:
        return self.session.scalar(
            select(AuthToken)
            .where(
                AuthToken.user_id == user_id,
                AuthToken.token_digest == digest,
                AuthToken.purpose == purpose,
            )
            .order_by(AuthToken.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def live_session(self, user_id: int, session_id: UUID) -> AuthToken | None:
        return self.session.scalar(
            select(AuthToken)
            .where(
                AuthToken.user_id == user_id,
                AuthToken.session_id == session_id,
                AuthToken.purpose == "REFRESH",
                AuthToken.revoked_at.is_(None),
            )
            .execution_options(populate_existing=True)
        )

    def insert_token(
        self, user: AppUser, purpose: str, digest: bytes, expiry: datetime, session_id: UUID | None
    ) -> AuthToken:
        token = AuthToken(
            user_id=user.id,
            purpose=purpose,
            token_digest=digest,
            expires_at=expiry,
            auth_version=user.auth_version,
            session_id=session_id,
        )
        self.session.add(token)
        self.session.flush()
        self.session.refresh(token)
        return token

    def revoke_session(self, user_id: int, session_id: UUID, now: datetime) -> None:
        tokens = self.session.scalars(
            select(AuthToken)
            .where(
                AuthToken.user_id == user_id,
                AuthToken.session_id == session_id,
                AuthToken.purpose == "REFRESH",
                AuthToken.revoked_at.is_(None),
            )
            .order_by(AuthToken.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        for token in tokens:
            token.revoked_at = now
        self.session.flush()

    def revoke_user_tokens(self, user_id: int, purposes: tuple[str, ...], now: datetime) -> None:
        tokens = self.session.scalars(
            select(AuthToken)
            .where(
                AuthToken.user_id == user_id,
                AuthToken.purpose.in_(purposes),
                AuthToken.revoked_at.is_(None),
            )
            .order_by(AuthToken.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        for token in tokens:
            token.revoked_at = now
        self.session.flush()

    def update_password_hash(self, user: AppUser, encoded: str) -> None:
        user.password_hash = encoded
        self.session.flush()
        self.session.refresh(user)

    def get_allowed_function_codes(self, group_id: int) -> list[str]:
        return list(
            self.session.scalars(
                select(AppFunction.code)
                .join(GroupPermission, GroupPermission.function_id == AppFunction.id)
                .where(GroupPermission.group_id == group_id, GroupPermission.is_allowed.is_(True))
                .distinct()
                .order_by(AppFunction.code)
            )
        )
