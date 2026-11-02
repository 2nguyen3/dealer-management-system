from datetime import UTC, datetime, timedelta
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.auth.models import AuthToken
from app.modules.auth.service import AuthService
from app.modules.auth.tokens import digest_opaque_token
from app.modules.users.schemas import AdminPasswordReset, UserCreate, UserUpdate
from tests.integration.catalogues.helpers import service_for
from tests.integration.catalogues.test_state import precondition

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("change", ["group", "status", "reset"])
@pytest.mark.parametrize("failure", ["after_invalidation", "commit"])
def test_failed_admin_write_restores_hash_version_all_tokens_audit(engine, actor, change, failure):
    settings = Settings(
        _env_file=None,
        db_host="test",
        db_user="test",
        db_password="test",
        auth_signing_key="synthetic-test-key-32-bytes-or-more",
    )
    with Session(engine) as session:
        service = service_for("users", session, actor)
        user = service.create(
            UserCreate(fullName="User", email="user@example.com", password="x", groupId=2)
        )
        login = AuthService(session, settings, Mock()).login("user@example.com", "x")
        session.add(
            AuthToken(
                user_id=int(user.id),
                purpose="PASSWORD_RESET",
                session_id=None,
                token_digest=digest_opaque_token(uuid4().hex),
                auth_version=1,
                expires_at=datetime.now(UTC) + timedelta(days=1),
            )
        )
        session.commit()
        before = session.execute(
            text(
                'SELECT "passwordHash","authVersion",status,"groupId" '
                "FROM dms.app_user WHERE id=:id"
            ),
            {"id": int(user.id)},
        ).one()
        tokens = session.execute(
            text('SELECT id,"revokedAt" FROM dms.auth_token WHERE "userId"=:id ORDER BY id'),
            {"id": int(user.id)},
        ).all()
        audit = session.scalar(text("SELECT count(*) FROM dms.audit_log"))
        original = session.execute

        def fail(sql, *args, **kwargs):
            if str(sql) == "SET CONSTRAINTS ALL IMMEDIATE":
                raise RuntimeError("after invalidation")
            return original(sql, *args, **kwargs)

        injector = (
            patch.object(session, "commit", side_effect=RuntimeError("commit"))
            if failure == "commit"
            else patch.object(session, "execute", side_effect=fail)
        )
        with injector, pytest.raises(RuntimeError):
            if change == "reset":
                service.reset_password(
                    int(user.id),
                    AdminPasswordReset(newPassword="new"),
                    precondition(service, int(user.id)),
                )
            else:
                service.update(
                    int(user.id),
                    UserUpdate.model_validate(
                        {"groupId": 3} if change == "group" else {"status": "LOCKED"}
                    ),
                    precondition(service, int(user.id)),
                )
        with engine.connect() as connection:
            assert (
                connection.execute(
                    text(
                        'SELECT "passwordHash","authVersion",status,"groupId" '
                        "FROM dms.app_user WHERE id=:id"
                    ),
                    {"id": int(user.id)},
                ).one()
                == before
            )
            assert (
                connection.execute(
                    text(
                        'SELECT id,"revokedAt" FROM dms.auth_token WHERE "userId"=:id ORDER BY id'
                    ),
                    {"id": int(user.id)},
                ).all()
                == tokens
            )
            assert connection.scalar(text("SELECT count(*) FROM dms.audit_log")) == audit
        assert AuthService(session, settings, Mock()).authenticate(login.accessToken)
