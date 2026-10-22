# Agentra frontend

React 19 + Vite + strict TypeScript, ESLint, and Prettier. Use Node.js 24 LTS
(minimum 22.12) and npm. Commit `package-lock.json` when dependencies change.

## Local development

From `ui/`:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Run the backend on port 8000 in a second terminal.
Vite proxies `/api` to FastAPI so local requests use the same origin.

The starter page checks API liveness and links to Swagger UI. It does not check
the database; use `/api/v1/health/ready` to verify Supabase connectivity.

The default API base URL is `/api/v1`. To override it, copy `.env.example` to
`.env` and set `VITE_API_BASE_URL`. Vite variables are public and are embedded
at build time. Never put database credentials or service-role keys in them.
An external API origin also needs the frontend origin in backend `CORS_ORIGINS`.

## Structure

```text
src/
  app/          # Application composition
  lib/          # Shared infrastructure, including API calls
  main.tsx      # React entry point
  styles.css    # Global styles
```

Group future features under `src/features/<feature>/`, keeping their components,
hooks, and types together. Promote code to shared modules when it is reused.

## Commands

```sh
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run preview
```

`preview` serves a local production build; it is not a production server and
does not provide the development API proxy. Use Docker Compose for a full-stack
production-build smoke test. `npm run format` applies Prettier formatting.

## Docker

The multi-stage Dockerfile builds static assets and serves them with unprivileged
Nginx on port 8080. Nginx provides SPA fallback, asset caching, and `/api/` proxying
to the `backend` service on the Compose network. Run from the repository root:

```sh
docker compose up --build -d --wait --wait-timeout 120
```

Compose waits for backend database readiness before starting the frontend. Fill
in `backend/.env` with valid Supabase settings first. The frontend health check
verifies writable cache storage, the compiled index, Nginx `/healthz`, and proxied
API/database readiness. Probes run every 30 seconds with a 15-second timeout, three
retries, 20-second startup grace period and five-second startup intervals. `/healthz`
by itself checks only Nginx liveness. Use Engine 25+/Compose 2.20.2+ for startup intervals.

Repository-root `data/frontend/` is bind-mounted to `/var/cache/nginx`; Nginx stores
request-body and upstream-response buffers under `client_temp/` and `proxy_temp/`.
Compiled assets come from the image. The entire root `data/` directory is Git-ignored
and host files survive container recreation. On Linux, grant the current Nginx
UID/GID `101:101` ownership of the host directory; Docker Desktop on Windows provides
writable shared folders. Logs use Docker stdout/stderr rotation (10 MB, three files).

For a separate API deployment, set `VITE_API_BASE_URL` in the shell or root `.env`
to override the Docker build argument and configure CORS. `ui/.env` configures
local Vite, not Compose build arguments. The API documentation link uses the default
same-origin `/api/docs` route. See the root README for environment setup.
