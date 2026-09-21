# AI development setup

This directory stores shared workflow references. `.agent/` is not an automatic
configuration directory for either tool; instructions and commands explicitly
reference the files here.

## OpenCode

Start `opencode` from the repository root. Root `AGENTS.md` supplies project context;
`opencode.json` loads the verification reference and project options. Commands in
`.opencode/commands/` provide:

- `/check-backend`: backend lint, formatting, and tests.
- `/check-ui`: frontend lint, types, formatting, and build.
- `/docker-status`: container state and application health without restarting.

Quit and restart OpenCode after editing its configuration or command definitions.
Keep provider authentication and model selection in your existing user settings.

## Claude Code

Start `claude` from the repository root. `CLAUDE.md` imports the shared project
instructions. Nested `backend/CLAUDE.md` and `ui/CLAUDE.md` import component guides.
`.claude/settings.json` configures permissions for routine read-only Git inspection
and verification commands; other permissions retain the tool's normal behavior.
The same three slash commands are available through `.claude/commands/`.

Use `/status` to confirm settings sources and `/memory` to inspect loaded
instructions. Start a new session after adding the instruction files and commands.
Personal overrides belong in ignored `.claude/settings.local.json`; personal
instructions can go in ignored `CLAUDE.local.md`.

## Shared workflows

- [Verification](workflows/verify.md)
- [Docker operations](workflows/docker.md)

Commands are prompts for the coding assistant, not shell scripts. They select the
proper working directory and report outcomes. Docker status does not imply
permission to restart services or apply migrations.
