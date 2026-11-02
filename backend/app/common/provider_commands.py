"""Complete an accepted provider command after its verified domain outcome commits."""

from sqlalchemy import select, text

from app.common.commands import ApiCommand, CommandRepository, CommandResult


def finish_provider_command(session, command_id, result, authorize):
    try:
        authorize()
        command = session.scalars(
            select(ApiCommand)
            .where(ApiCommand.id == command_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        ).one()
        authorize()  # Command ownership may have required a lock wait.
        if command.state == "COMPLETED":
            result = CommandResult.model_validate(command.result).checked()
        else:
            result = result.checked()
            CommandRepository(session).complete(command, result)
        session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
        session.commit()
        return result
    except Exception:
        session.rollback()
        raise
