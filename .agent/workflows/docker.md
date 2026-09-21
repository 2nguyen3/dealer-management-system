# Docker workflow

Run Compose commands from the repository root. The database is external Supabase,
not a container in this project. Read `compose.yaml` and the root README first.

## Inspect without restarting

```sh
docker compose ps
docker compose logs --tail 100 backend frontend
```

Check these default URLs, respecting `WEB_PORT` and `API_PORT` overrides:

- `http://localhost:8080/`: frontend.
- `http://localhost:8080/healthz`: Nginx health.
- `http://localhost:8000/api/v1/health`: API liveness.
- `http://localhost:8000/api/v1/health/ready`: database readiness.
- `http://localhost:8000/api/docs`: Swagger docs.

Report HTTP status codes and generic response summaries. Do not print database
credentials or raw configuration dumps. Review logs before quoting them.

## Build/start when requested

Confirm the user has populated `DB_PASSWORD` in `backend/.env`. The example
contains host/user information but intentionally leaves the password blank.

```sh
docker compose up --build -d --wait --wait-timeout 120
docker compose ps
```

Verify readiness and application URLs after startup. Backend readiness gates
frontend startup; unhealthy status alone does not trigger a Docker restart.

## Migrations

Run reviewed migrations explicitly when the task calls for applying them:

```sh
docker compose --profile tools run --rm migrate
```

Use a session-pooler/direct connection for migrations. Do not treat container
inspection as a request to migrate, stop containers, or delete volumes.
