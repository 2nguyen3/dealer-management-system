from collections.abc import Callable, Mapping

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.common.commands import (
    ApiCommand,
    CommandRepository,
    CommandResult,
    CommandScope,
    request_fingerprint,
)
from app.core.exceptions import ApiError


def translate_database_error(
    error: DBAPIError, conflicts: Mapping[tuple[str, str | None], tuple[str, str]]
) -> ApiError:
    state = getattr(error.orig, "sqlstate", None)
    constraint = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
    mapped = conflicts.get((state, constraint))
    if mapped is not None:
        return ApiError(409, mapped[0], mapped[1])
    if state in ("55P03", "40001", "40P01"):
        return ApiError(409, "RESOURCE_BUSY", "Resource is busy; retry the same intent")
    return ApiError(500, "INTERNAL_ERROR", "Internal server error")


class TransactionRunner:
    """Own the request transaction, including any transaction started by auth reads.

    authorize must reload the current actor and check current grants on every
    attempt and replay. work performs only database effects and validates its typed
    outward projection before returning. Neither callback may commit or call a
    provider. Uncertain commit is surfaced; a later same-key request recovers it.
    """

    def __init__(self, session: Session, *, max_attempts: int = 3) -> None:
        if not 1 <= max_attempts <= 5:
            raise ValueError("Invalid transaction retry budget")
        self.session = session
        self.max_attempts = max_attempts

    def run(
        self,
        scope: CommandScope,
        payload: object,
        *,
        authorize: Callable[[], None],
        work: Callable[[ApiCommand], Callable[[], CommandResult]],
        conflicts: Mapping[tuple[str, str | None], tuple[str, str]] | None = None,
    ) -> CommandResult:
        digest = request_fingerprint(payload)
        attempt = 0
        while True:
            committing = False
            try:
                authorize()
                repository = CommandRepository(self.session)
                command, fresh = repository.claim(scope, digest)
                # Claim may wait for another transaction. Replays need the same
                # live authorization check as fresh work after that wait.
                authorize()
                if fresh:
                    project = work(command)
                    self.session.flush()
                    self.session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
                    result = project().checked()
                    repository.complete(command, result)
                else:
                    if command.result is None:
                        raise ApiError(409, "RESOURCE_BUSY", "Command is still in progress")
                    result = CommandResult.model_validate(command.result).checked()
                committing = True
                self.session.commit()
                return result
            except DBAPIError as error:
                self.session.rollback()
                state = getattr(error.orig, "sqlstate", None)
                attempt += 1
                if state in ("40001", "40P01") and attempt < self.max_attempts:
                    continue
                if committing and (error.connection_invalidated or state is None):
                    raise ApiError(
                        409,
                        "COMMAND_OUTCOME_UNKNOWN",
                        "Retry the same command key to recover the outcome",
                    ) from None
                raise translate_database_error(error, conflicts or {}) from None
            except Exception:
                self.session.rollback()
                raise
