# Verification workflow

Choose checks according to the changed component. Inspect installed dependencies
first; use `uv sync --frozen` in `backend/` or `npm ci` in `ui/` if installation is
needed. Do not substitute unlocked dependency updates.

## Backend (working directory: backend/)

```sh
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Tests inject settings and mock database sessions; a live Supabase connection is
not required. Add meaningful regression tests for behavior changes.

## Frontend (working directory: ui/)

```sh
npm run lint
npm run typecheck
npm run format:check
npm run build
```

There is no frontend test runner configured. Verify changed interactions and
responsive layouts in a browser when browser tooling is available; report when
this was not possible.

## Compose and documentation (working directory: repository root)

```sh
docker compose --profile tools config --quiet
git diff --check
```

Compose validation requires `backend/.env` to exist. If it is missing, report that
prerequisite rather than inventing credentials. Use `--quiet` to avoid printing
resolved secrets. For documentation-only work, verify referenced paths/commands
and formatting instead of running unrelated application tests.

Summarize what passed, what failed, and what was not run. Do not claim a passing
static configuration check proves runtime database connectivity.
