from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

from app.common.commands import CommandRepository, CommandResult
from app.common.provider_commands import finish_provider_command


def test_completed_provider_response_is_immutable_and_reauthorized_after_lock():
    session = Mock()
    saved = CommandResult(status=200, body={"id": "1", "status": "SUCCESS"})
    session.scalars.return_value.one.return_value = SimpleNamespace(
        state="COMPLETED", result=saved.model_dump(mode="json")
    )
    authorize = Mock()
    assert (
        finish_provider_command(
            session, uuid4(), CommandResult(status=200, body={"status": "FAILED"}), authorize
        )
        == saved
    )
    assert authorize.call_count == 2
    session.commit.assert_called_once()


def test_finalize_acceptance_and_failure_roll_back_without_caching_uncommitted_result():
    session = Mock()
    command = SimpleNamespace(state="ACCEPTED")
    session.scalars.return_value.one.return_value = command
    result = CommandResult(status=200, body={"id": "1", "state": "SUCCESS"})
    with patch.object(CommandRepository, "complete") as complete:
        assert finish_provider_command(session, uuid4(), result, lambda: None) == result
        complete.assert_called_once_with(command, result)
    session.commit.side_effect = RuntimeError("definite-commit")
    with patch.object(CommandRepository, "complete"):
        with pytest.raises(RuntimeError, match="definite-commit"):
            finish_provider_command(session, uuid4(), result, lambda: None)
    session.rollback.assert_called_once()
